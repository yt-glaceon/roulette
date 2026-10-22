# 調査: CORS の許可オリジン判定を完全一致にする(cors-exact-match)

- 日付: 2026-10-22
- ステータス: 完了
- 関連する設計ドキュメント: [2026-10-22-cors-exact-match.md](../designs/2026-10-22-cors-exact-match.md)

## 背景・目的

README 更新のトピック(PR yt-glaceon/roulette#10)の設計レビューで、`server/index.js` の CORS 判定が前方一致(`origin.startsWith(allowed)`)であることが分かった。文書だけの PR では直さずフォローアップにした。API はアクセストークン必須なので実害は限られるが、「許可リストのオリジンだけ許す」という意図と合っていない。完全一致に直す方法と、Origin ヘッダが無いリクエストの扱いを決める。

## 現状の把握

- `server/index.js:125-141` の CORS 設定:
  - `allowedOrigins = ['https://yt-glaceon.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500']`
  - `origin` 関数で `!origin || allowedOrigins.some(allowed => origin.startsWith(allowed))` なら許可、それ以外は `callback(new Error('Not allowed by CORS'))`
- 前方一致のため、次のようなオリジンも許可される。
  - `https://yt-glaceon.github.io.attacker.example`(別ドメイン)
  - `http://localhost:55000`・`http://localhost:5500.evil.example`(別ポート・別ホスト)
  - `http://127.0.0.1:55001` など
- Origin ヘッダが無いリクエストは許可している(コメントでは「同一オリジンリクエスト」)。
- ルート:
  - `GET /` はヘルスチェック(トークン不要)。Render のヘルスチェックや curl は Origin ヘッダを付けない。
  - `GET /api/*` はすべて `validateToken`(`x-access-token` ヘッダ)が必要。
- フロントエンド(`js/discord-client.js`)は GitHub Pages(`https://yt-glaceon.github.io`)から Render のバックエンドへクロスオリジンで `fetch` する。ブラウザはクロスオリジンの fetch に必ず Origin を付け、その値はスキーム・ホスト(小文字)・既定以外のポートで、末尾スラッシュもパスも付かない。したがって完全一致の文字列比較で正しく判定できる。
- 拒否時の挙動: `callback(new Error(...))` は Express のエラーハンドラに渡り、500 が返る(CORS ヘッダは付かない)。
- テスト: server/ にはテストスクリプトが無いが、`server/log-safe.js` を `tests/unit/server-log-safe.test.js` から import してルートの `npm test`(Jest、ESM)で単体テストしている前例がある。`server/index.js` は import 時に Bot ログイン・`app.listen` が走るため、テストからは import できない。判定ロジックを別ファイルに切り出す必要がある。
- 文書: README.md(274-276, 286 行)、server/README.md(59-61, 207-210 行)、SETUP.md(61, 164-175 行)が `allowedOrigins` を説明している。いずれも「含まれているか」「追加する」という書き方で、前方一致・完全一致には触れていない。

## 選択肢の比較

### 判定方法

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A: 判定を純粋関数 `isAllowedOrigin(origin, allowedOrigins)` に切り出し `allowedOrigins.includes(origin)` で完全一致。`cors` の `origin` 関数から呼ぶ | 単体テストできる(log-safe.js の前例と同じ形)。Origin 無しの扱いを関数の仕様として明示できる | ファイルが1つ増える | 推奨 |
| 案B: `cors({ origin: allowedOrigins })` と配列を直接渡す(cors パッケージが文字列は `===` で比較する) | コードが最短 | 判定がライブラリの内部にあり単体テストしにくい。Origin 無しの扱いがライブラリ任せで見えにくい | |
| 案C: `new URL(origin)` で分解してスキーム・ホスト・ポートを比較 | 表記ゆれに強い | ブラウザの Origin は正規化済みなので不要に複雑。`null` 等の不正値の例外処理が要る | |

### Origin ヘッダが無いリクエストの扱い

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案1: 今どおり許可する | Render のヘルスチェック・curl・サーバー間の呼び出しが通る。CORS はブラウザに読ませるかどうかの仕組みで、Origin を付けないクライアントには元から効かない(拒否しても守りにならない) | 特になし(API はトークンで守られている) | 推奨 |
| 案2: 拒否する | 見た目は厳しい | ヘルスチェック `GET /` が 500 になり、Render がサービスを不健全と判定しうる。curl で動作確認できなくなる。Origin を偽れる/省けるクライアントには効果が無い | |

## 推奨アプローチ

- 案A + 案1。
- `server/cors-origin.js`(仮)に `isAllowedOrigin(origin, allowedOrigins)` を置き、Origin が無い(`undefined`)場合は `true`、それ以外は `allowedOrigins.includes(origin)` で完全一致を返す。
- `server/index.js` の `origin` 関数はこれを呼ぶだけにし、コメントを「Origin 無しはブラウザ以外(ヘルスチェック・curl)からの呼び出し。CORS はブラウザにしか効かないので許可する」という意図に直す。
- `tests/unit/server-cors-origin.test.js` で、許可リストの3オリジン・前方一致で通っていた攻撃例・Origin 無し・`'null'`・末尾スラッシュ付き・大文字違いを確認する。
- 文書(README.md・server/README.md・SETUP.md)に「オリジンは完全一致で判定する(スキーム・ホスト・ポートまで一致、末尾 `/` なし)」ことを書き足す。

## 制約・リスク

- server/ を変えるので main へのマージで Render に自動デプロイされる。許可リストの3オリジンは完全一致でも通るので、本番のフロントエンドは影響を受けない。GitHub Pages のオリジンは `https://yt-glaceon.github.io`(パス `/roulette` は Origin に含まれない)。
- 拒否時に 500 を返す挙動は今回変えない(範囲外)。
- ワークツリーの `server/.env` は本番トークン。起動確認はダミートークンで行う(共有メモリ [[worktree-server-env-live-token]])。
- Jest は ESM 実行のため、テストでは `jest` グローバルに頼らない(共有メモリ [[jest-esm-globals]])。今回はモック不要の純粋関数なので影響は小さい。

## 未解決の疑問・要確認事項

- 拒否時のステータスを 500 から「CORS ヘッダを付けないだけ(`callback(null, false)`)」に変えるかは今回の範囲外。必要なら別トピックとする。

## 参考資料

- `server/index.js:125-141`
- `server/log-safe.js`・`tests/unit/server-log-safe.test.js`(切り出しとテストの前例)
- cors パッケージ(`server/node_modules/cors/lib/index.js` の `isOriginAllowed`)
- MDN: Origin ヘッダ(クロスオリジンの fetch では常に送られ、値は `<scheme>://<host>[:<port>]`)

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
