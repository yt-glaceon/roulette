# 設計: CORS の許可オリジン判定を完全一致にする(cors-exact-match)

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-22-cors-exact-match.md](../investigations/2026-10-22-cors-exact-match.md)
- 承認者: 人間(ゲート1)
- 承認日: 2026-10-22

## 目的・スコープ

### やること

- CORS の許可判定を前方一致(`startsWith`)からオリジンの完全一致に直す。
- 判定を純粋関数に切り出し、ルートの `npm test` で単体テストする。
- Origin ヘッダが無いリクエストは今どおり許可し、その理由をコードのコメントと文書に書く。
- README.md・server/README.md・SETUP.md の CORS の説明に「完全一致で判定する」ことを書き足す。

### やらないこと(スコープ外)

- 許可リストの中身(3オリジン)を変えること。環境変数化もしない。
- 拒否時に 500(`callback(new Error(...))`)を返す挙動の変更。
- `methods: ['GET']` などその他の CORS 設定の変更。
- `server/index.js` の他の部分の整理。

## アーキテクチャ・変更概要

### 新規 `server/cors-origin.js`

`server/log-safe.js` と同じく、副作用の無い純粋関数だけを置く ESM モジュール。JSDoc の書き方も log-safe.js に合わせる。許可リスト自体は今までどおり `server/index.js` の `allowedOrigins` に置き、引数で渡す(文書の参照先を変えずに済み、テストでも任意のリストを渡せる)。

```js
/**
 * リクエストのオリジンを許可するか判定する
 * - Origin ヘッダが無い(undefined)ときは許可する。ヘルスチェック・curl などブラウザ以外の呼び出しで、
 *   CORS はブラウザにしか効かないため拒否しても守りにならない。API はアクセストークンで守る
 * - それ以外は allowedOrigins のどれかと完全一致するときだけ許可する(前方一致・大文字小文字の違い・末尾 `/` は許可しない)
 * @param {string | undefined} origin
 * @param {readonly string[]} allowedOrigins
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, allowedOrigins) { ... }
```

- 判定: `origin === undefined` なら `true`、それ以外は `allowedOrigins.includes(origin)`。
- 空文字 `''` は Origin ヘッダが「ある」扱いで、許可リストに無いので拒否する(`!origin` ではなく `=== undefined` で判定する)。cors パッケージは `req.headers.origin` をそのまま渡すので、ヘッダが無いときだけ `undefined` になる。
- `'null'`(file:// やサンドボックス iframe から送られる文字列)は拒否される。
- cors パッケージは文字列か `undefined` しか渡さないが、文字列以外(`null`・数値)が来ても `includes` で拒否される。これを仕様としてテストで固定する。
- コードスタイルは前例に合わせる: `server/` は2スペース、`tests/unit/` は4スペースのインデント。テストは `fast-check` を default import し、`describe`/`test`/`expect` はグローバルを使う(`jest` グローバルは使わない)。

### `server/index.js`

- `allowedOrigins` 配列はそのまま残し、直前のコメントに「ブラウザが送る Origin と同じ形(スキーム://ホスト[:ポート]、末尾 `/` なし)で書く。完全一致で判定する」を足す。
- `import { isAllowedOrigin } from './cors-origin.js';` を追加する。
- `origin` 関数を次の形にする。拒否時の `callback(new Error('Not allowed by CORS'))` はそのまま。

```js
app.use(cors({
  origin: (origin, callback) => {
    // Origin ヘッダが無いリクエスト(ヘルスチェック・curl)は許可し、それ以外は allowedOrigins と完全一致するものだけ許可する
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET'],
}));
```

### 文書

許可リストの場所(`server/index.js` の `allowedOrigins`)は変わらないので参照はそのまま。完全一致であることと Origin 無しの扱いを書き足す。

- README.md
  - 274-276 行「CORS エラー」: 「オリジンはスキーム・ホスト・ポートまで完全一致で判定する(末尾 `/` を付けない)」旨を足す。
  - 286 行(セキュリティ): 主語を限定して「ブラウザからのクロスオリジンアクセスを `server/index.js` の `allowedOrigins` と完全一致するオリジンに制限」のように書く(Origin ヘッダ無しは許可しているので「のみ許可」と言い切らない)。
- server/README.md
  - 59-61 行「CORS」節: 完全一致であること、判定は `server/cors-origin.js` にあること、Origin ヘッダの無いリクエスト(ヘルスチェック・curl)は許可していることとその理由を書く。
  - 11 行の機能一覧「CORS 設定」はそのまま。
  - 207-210 行「CORS エラー」: 完全一致である旨を足す。
- SETUP.md
  - 61 行: 完全一致である旨を足す。
  - 164-175 行「CORS エラーが発生する」: 確認手順に「末尾 `/` やポート・スキームの違いも不一致になる」を足す。
- 文書の括弧は既存に合わせて全角(PR yt-glaceon/roulette#10 で揃えた)。

## 実装ステップ

- [x] ステップ1: `server/cors-origin.js` を新規作成(`isAllowedOrigin`)
- [x] ステップ2: `tests/unit/server-cors-origin.test.js` を新規作成(下記テスト戦略のケース)
- [x] ステップ3: `server/index.js` の CORS 設定を `isAllowedOrigin` を使う形に置き換える(`allowedOrigins` は残す)
- [x] ステップ4: README.md・server/README.md・SETUP.md の CORS の記述を直す

ステップ1〜3は同じ担当でまとめて実装してよい(テストが関数に依存し、index.js も関数に依存する)。ステップ4は独立しているので並列にできる。

## テスト戦略

**自動テストを新規作成するか:** する(単体テスト、`tests/unit/server-cors-origin.test.js`)。`server-log-safe.test.js` と同じく `../../server/cors-origin.js` を import する。モックは使わない。

テストケース(本番と同じ3オリジンの許可リストをテスト内で定義して渡す):

- 許可: `https://yt-glaceon.github.io`・`http://localhost:5500`・`http://127.0.0.1:5500`
- 許可: `undefined`(Origin ヘッダ無し)
- 拒否(前方一致で通っていたもの): `https://yt-glaceon.github.io.attacker.example`・`http://localhost:55000`・`http://localhost:5500.evil.example`・`http://127.0.0.1:55001`
- 拒否(表記違い): `https://yt-glaceon.github.io/`(末尾 `/`)・`https://YT-GLACEON.github.io`(大文字)・`http://yt-glaceon.github.io`(スキーム違い)・`https://yt-glaceon.github.io:443`
- 拒否(その他): `'null'`・`''`・`https://example.com`・文字列以外の `null`・数値
- 別の許可リストを渡せること(例: `['https://a.example']` で `https://a.example` が許可、`https://yt-glaceon.github.io` が拒否)
- 空の許可リストでは Origin 無し以外すべて拒否
- fast-check のプロパティテスト: 許可リストのどれかに1文字以上の文字列を後ろに付けたものは常に拒否される(生成した値が許可リストのどれとも等しくないことを `fc.pre` で前提にする)

完了の基準:

- `npm test` が通る(新規テストを含む)。既知の不安定テスト `drum-roll.test.js`(共有メモリ [[drum-roll-test-timeout-flaky]])が落ちた場合は単体再実行で切り分けて記録する。
- `npm run lint`・`npm run build` が通る。
- 起動確認: ダミートークンで `server/` を起動し、curl で次を確かめる(本番トークンは使わない。共有メモリ [[worktree-server-env-live-token]])。
  - Origin 無しの `GET /` → 200
  - `Origin: https://yt-glaceon.github.io` の `GET /` → 200 で `Access-Control-Allow-Origin: https://yt-glaceon.github.io`
  - `Origin: https://yt-glaceon.github.io.attacker.example` の `GET /` → 500 で `Access-Control-Allow-Origin` 無し
- PR の CI(`verify`)が緑。
- 3つの文書すべてに「完全一致」の記述がある(各ファイルを `完全一致` で grep して確認)。
- `server/index.js` に旧ロジックの `startsWith` が残っていない(grep で 0 件)。

## リスク・トレードオフ

- 本番のフロントエンド(`https://yt-glaceon.github.io`)は完全一致でも通るので影響は無い。ローカル開発で 5500 以外のポート(例: Vite の 5173)から開いていた場合は弾かれるようになるが、許可リストの意図どおり。現状でも 5173 は前方一致で通らないため、実質の変化は「許可リストの文字列の後ろに何か付いたオリジン」だけ。
- Origin 無しを許可し続けるのはトレードオフではなく、CORS の仕組み上の前提(ブラウザ以外には効かない)。API の保護はアクセストークンが担う。
- server/ を変えるので main へのマージで Render に自動デプロイされる。

## ロールバック方針

PR を revert して main にマージすれば Render が前の版を自動デプロイする。Render の管理画面から前のデプロイに戻すこともできる。

## 設計レビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | MINOR のみ: プロパティテストの前提(`fc.pre`)、文字列以外の origin の仕様化、コードスタイルの前例指定、`startsWith` 残存の grep 確認、README 286 行の主語の限定。すべて設計に反映済み |

未解決のMAJORが残った場合: なし

## コードレビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | MINOR: `server/cors-origin.js` とテストの日本語の括弧が半角だった(前例は全角)→ implementer が全角にそろえた |

未解決のMAJORが残った場合: なし

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 承認 | Skill 化候補2件(jest-esm-globals・worktree-server-env-live-token)も Skill 化を承認 |

---
スキル化候補: [[jest-esm-globals]](related_topics 3件)、[[worktree-server-env-live-token]](related_topics 3件)

## 壁打ち(grilling)の記録

- Origin ヘッダ無しのリクエスト: 今どおり許可する(人間が確認、2026-10-22)。ヘルスチェック `GET /` と curl を通すため。CORS はブラウザにしか効かない。
- 拒否時の 500: 今回は変えない(人間が確認)。必要なら別トピック。
- 許可リストは `server/index.js` の `allowedOrigins` に残し、判定関数に引数で渡す(文書の参照先を変えないため)。
