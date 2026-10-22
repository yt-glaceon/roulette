# テストレポート: readme-refresh

- 日付: 2026-10-22
- ステータス: 修正依頼
- 対応する設計ドキュメント: docs/designs/2026-10-22-readme-refresh.md

## テスト対象

`README.md`・`SETUP.md`・`server/README.md` を現状の実装に合わせて直した文書だけの変更(`git diff origin/main` で `js/`・`tests/`・`css/`・`index.html`・`server/index.js`・`vite.config.js`・`package.json` の差分は 0 件)。設計のタスク1〜3(A・B・C・G と、D・E・F)の全範囲。

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test`。全体を 4 回、`--runInBand` で 3 回、drum-roll 単体で 4 回、合計 11 回実行 | **fail**(全回で `tests/unit/drum-roll.test.js` が 1〜6 件失敗。下記) |
| ビルド | `npm run build` | pass(15 modules、`dist/` 出力) |
| Lint | `npm run lint`(`eslint . --max-warnings 0`) | pass(警告 0) |
| 手動確認(機械チェック) | 設計「テスト戦略」の機械チェック全項目(下表) | pass(全項目) |
| 手動確認(実装との照合) | 401 メッセージ・allowedOrigins・FRONTEND_URL 既定値・演出 UI・vite base・CI/deploy を実ファイルと照合 | pass |
| 手動確認(Markdown 構造) | コードフェンス数・表の列数・番号付きリスト | pass |

### `npm test` の失敗(文書の変更とは無関係)

- 結果: `Test Suites: 1 failed, 13 passed`、失敗は毎回 `tests/unit/drum-roll.test.js` のみ。件数は実行ごとに 1〜6 件で変動(例: `Tests: 5 failed, 162 passed` / `1 failed, 166 passed` / `6 failed, 161 passed`)。他の 13 スイートは毎回 pass。
- 主な失敗: 「最後の切り替えの直前は当選者ではなく、1人ずつ進む…」が `Exceeded timeout of 5000 ms`(Jest 既定タイムアウト)。ほかに `expect(jest.getTimerCount()).toBe(0)` などの失敗が出る回もある。
- 原因の見立て: `drum-roll.test.js` が偽タイマーの重い反復と実時間(最大 6 秒台)のテストを含み、この環境では 5 秒に収まらない。`git diff origin/main` に `js/`・`tests/` の差分が無いため、本トピックの変更が原因ではない(main でも再現するはずだが、main のチェックアウトには触れていないため未確認)。
- 判断: `verify` のコマンドが失敗しているため、テストを緩めず不合格として扱う。共有メモリに [drum-roll-test-timeout-flaky](../memory/entries/drum-roll-test-timeout-flaky.md) を追記した。

## 機械チェックの結果

| チェック | README.md | SETUP.md | server/README.md | 結果 |
| --- | --- | --- | --- | --- |
| `?token=xxx` が 0 件 | 0 | 0 | 0 | OK |
| `git push origin main` が 0 件(Grep ツール) | 0 | 0 | 0 | OK |
| `FRONTEND_URL=http://localhost:5500/roulette` で始まる行が 0 件 | 0 | 0 | 0 | OK |
| `CORS用`・`CORS設定用`・`CORS 用` が 0 件 | 0 | 0 | 0 | OK |
| 「フロントエンドの URL と完全に一致する必要があります」が 0 件 | 0 | 0 | 0 | OK |
| 「バックエンドの `FRONTEND_URL` が正しく設定されていない」が 0 件 | - | 0 | - | OK |
| `cp .env.example .env` が server 側の手順に無い | README.md:112(ルート「4. フロントエンドのセットアップ」) | SETUP.md:38(「3. 環境変数を設定」) | 0 | OK(残るのは設計で許容した 2 か所のみ) |
| `x-access-token` が 1 件以上 | 2 | (対象外)0 | 2 | OK |
| `localhost:5500/roulette/` が 1 件以上 | 2 | 2 | (対象外)0 | OK |
| `6秒間回転` が 0 件 | 0 | - | - | OK |
| `スロットマシン`・`カードめくり`・`ドラムロール` が各 1 件以上 | 各 3 | - | - | OK |
| `結果を見る` が 1 件以上 | 1 | - | - | OK |
| README の F-1・F-2 と server/README の F-4 の文面一致 | README.md:275-276, 279 | - | server/README.md:209-210, 214 | OK(同一文面) |
| `allowedOrigins` の 3 オリジンが `server/index.js:125-129` と一致 | (記載なし) | SETUP.md:61 | server/README.md:61 | OK(`https://yt-glaceon.github.io`・`http://localhost:5500`・`http://127.0.0.1:5500`) |
| 401 メッセージ 3 種類が `server/index.js:152,158,163` と完全一致 | - | - | server/README.md:79,83 | OK(「アクセストークンが必要です」「無効なトークンです」「トークンの有効期限が切れています」) |
| 構造図のパスが存在する(24 パス + `.github/workflows/{ci,deploy}.yml`・`.github/actions/verify`) | 全存在 | - | - | OK(MISSING 0 件) |
| 書かれた npm スクリプトが package.json に存在 | `test`・`test:watch`・`test:coverage`・`lint`・`build`・`preview`・`dev`・`start` | `lint`・`test`・`build`・`dev`・`preview` | `dev`・`start` | OK(ルート: dev/build/preview/lint/test/test:watch/test:coverage、server: start/dev) |

## 実装との照合

- FRONTEND_URL の既定値: `server/index.js:90` の `process.env.FRONTEND_URL || 'http://127.0.0.1:5500'` と、SETUP.md:61・server/README.md:57 の記載が一致。
- `FRONTEND_URL` は CORS に使われない: CORS 判定は `server/index.js:125-138` の `allowedOrigins` のみ。文書の説明と一致。
- `index.html:32-45`: 演出の選択肢は「円形ルーレット」「スロットマシン」「カードめくり」「ドラムロール」、時間スライダーは `min=3 max=10 value=6 step=1`、`index.html:51` にボタン「結果を見る」。README.md:7-8・53-57 と一致。
- `vite.config.js:6` の `base: '/roulette/'`。文書の `http://localhost:5500/roulette/` と一致。
- CI/deploy: `.github/actions/verify/action.yml` の順序は `npm ci` → `npm ci --prefix server` → lint → `node --check server/index.js` → test → build → モック混入チェックで、README.md:187 の説明と一致。`ci.yml` のジョブ名は `verify`、`deploy.yml` は `pre-deploy-verify` → build → deploy の依存(`needs`)で、文案P の流れと一致。
- ログの伏せ字: `server/log-safe.js` と `tests/unit/server-log-safe.test.js` が存在。

## Markdown 構造

- コードフェンス数: README.md 14、SETUP.md 26、server/README.md 22(すべて偶数で閉じている)。
- 表: README.md の「開発」表は 2 列で全行そろっている。server/README.md の環境変数表は 3 列、SETUP.md の Secrets 表は 3 列で、全行そろっている。
- 番号付きリスト: README.md の使い方は 1〜10 の連番、文案P の 1〜4、SETUP.md の自動デプロイ(109-112)・CORS 解決方法(171-173)も連番で崩れなし。

## 証跡(手動確認分)

該当なし(文書のみの変更で、curl・Playwright は不要。サーバーは `server/.env` が本番トークンのため起動していない)。上記のコマンド結果が証跡。

## 不合格・不具合の詳細

- 不合格項目: `npm test`(`.claude/loop.config.json` の `verify.test`)。
- 再現手順: ワークツリーのルートで `npm test`、または `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drum-roll.test.js`。
- 期待結果: 全スイート pass。
- 実際の結果: 11 回中 11 回で `drum-roll.test.js` が 1〜6 件失敗(主に 5000 ms のタイムアウト)。
- 備考: 文書の変更とは無関係の既存の不安定なテストと見られる。修正は `implementer` または別トピックで扱う(本エージェントはテストを緩めない)。

## 未検証の観点・既知の制限事項

- GitHub 上の表示(PR の Files changed の rich diff で、3 ファイルの Markdown、特に表・番号付きリスト・コードブロックが崩れないか)は、人間が PR で確認する項目。ローカルでは未確認。
- main のチェックアウトで `npm test` が同様に落ちるかは未確認(他のワークツリー・チェックアウトには触れないため)。
- サーバー(Bot・API)は起動していない。文書の記述はソースコードとの照合のみで、実際のレスポンスは確認していない。
- `allowedOrigins` の前方一致の件は設計でスコープ外(別トピックのフォローアップ。PR 本文に書く)。
- `e2e`・`typecheck` は `.claude/loop.config.json` で `null` のためスキップ。

## コードレビューからの引き継ぎ

ラウンド1 PASS、未解決の `MAJOR` なし。MINOR 2 件:

- SETUP.md の F-1 で、文案F の 1 文目だけでなく全文(CORS の 2 文を含む)を入れた件は、内容が実装どおりで読み手に有用なため許容。
- README.md で共通文案の括弧だけ半角だった表記ゆれは修正済み(全角に統一)。本テストでも README.md:99・136・275-286 の括弧を確認した。

## 総合判定

不合格

理由: `npm test` が `drum-roll.test.js` の失敗で通らない。ただし原因は文書の変更ではなく、既存のテストの不安定さと見られる。lint・build と、設計「テスト戦略」の文書に関する機械チェック・実装との照合はすべて合格。この判定を受けて、drum-roll の不安定さを本トピックの範囲外として扱うかどうかは、メインの会話で判断してほしい。

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
|  | 承認してクローズ / 修正依頼 / 設計からやり直し |  |
