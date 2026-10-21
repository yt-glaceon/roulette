# 設計: GitHub Actions による CI 追加(ESLint 導入・deploy 前検証・ブランチ保護)

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する調査ドキュメント: docs/investigations/2026-10-22-ci-actions.md
- 承認者: (承認ゲート通過時に記入)
- 承認日: (承認ゲート通過時に記入)

## 目的・スコープ

main への push で GitHub Pages に本番デプロイされるが、テスト・ビルド検証・Lint が PR 段階でも deploy 前でも走らない。PR 時点で自動検証し、検証に落ちたらデプロイしない仕組みと、main の保護を入れる。

### やること

1. `.github/workflows/ci.yml` を新設する。トリガーは main 向け `pull_request` と main への `push`。ジョブ名は `verify` で固定、paths フィルタ・ジョブ `if:` は使わない。
2. 検証手順を composite action `.github/actions/verify/action.yml` に集約し、ci.yml と deploy.yml の両方から使う。手順は次の順:
   `npm ci` → `npm ci --prefix server` → `npm run lint` → `node --check server/index.js` → `npm test` → `npm run build`(ダミー `VITE_API_URL`)→ dist へのモック混入チェック。
3. `deploy.yml` に検証ジョブ `pre-deploy-verify` を追加し、`build` が `needs` で待つ(`pre-deploy-verify` → `build` → `deploy`)。`concurrency: pages` は維持。
4. deploy.yml 内の既存 action を現行メジャーへ上げる(checkout v7、setup-node v7、configure-pages v6、upload-pages-artifact v5、deploy-pages v5)。あわせて `build` ジョブの npm キャッシュ(`cache: 'npm'`)を廃止する。
5. ESLint 10 系 + `@eslint/js` + `globals` を devDependencies に追加し、`eslint.config.js`(flat config、recommended)を新設。`package.json` に `lint` スクリプトを追加。既存違反(1 件)を直す。
6. このリポジトリ側の文書更新: `.claude/loop.config.json`(`verify.lint`、`deployNote`)、`docs/process/project-dev.md`(Lint 未導入の記述、CI 説明、release 時の CI 待ち)、共有メモリ `eslint-flat-config-ignores` の実測結果反映。
7. PR マージ後に main のブランチ保護を `gh api` で設定する手順を本設計に記す(実行はユーザー確認後にメインエージェントが行う。implementer の作業には含めない)。

### やらないこと(スコープ外)

- Prettier、TypeScript、型チェック、Lint ルールの追加・緩和(recommended のまま。実測で違反は 1 件のみ)。
- 自動テスト(Jest)の新規作成(理由はテスト戦略に記載)。
- loop-basic プラグイン本体の編集(upstream にコミットしない運用)。release 手順の変更はこのリポジトリの文書(project-dev.md)に注意書きとして書くに留める。
- server/ の自動デプロイ、server/ の Lint ルール個別調整、server/ のテスト追加。
- Rulesets によるブランチ保護、`strict: true`、承認必須化。
- action の SHA ピン留め(既存方針どおりメジャータグ。ピン留めは別トピック)。
- ci.yml への actionlint 組み込み(静的検査は実装時にローカルで一度流すのみ)。

## アーキテクチャ・変更概要

### 変更・新規ファイル一覧

| ファイル | 種別 | 内容 |
| --- | --- | --- |
| `package.json` | 変更 | devDependencies に `eslint`(^10)・`@eslint/js`(^10)・`globals`(^17)。scripts に `"lint": "eslint . --max-warnings 0"` |
| `package-lock.json` | 変更 | 上記に伴う更新 |
| `eslint.config.js` | 新規 | flat config(下記) |
| `tests/unit/slot-machine.test.js` | 変更 | L300 の未使用変数 `rafSpy` の解消 |
| `.github/actions/verify/action.yml` | 新規 | 検証手順の composite action |
| `.github/workflows/ci.yml` | 新規 | PR / main push で `verify` ジョブを実行 |
| `.github/workflows/deploy.yml` | 変更 | `pre-deploy-verify` ジョブ追加、`build` に `needs`、action 更新、Node 指定変更、`build` の npm キャッシュ廃止 |
| `.claude/loop.config.json` | 変更 | `verify.lint` = `npm run lint`、`deployNote` 更新 |
| `docs/process/project-dev.md` | 変更 | 構成の「Lint 未導入」記述の更新、CI/検証の補足 |
| `docs/memory/entries/eslint-flat-config-ignores.md` | 変更 | 背景に実測結果(違反 1 件)を反映、`updated` 更新 |

### ESLint 設定(eslint.config.js)

- ルートが `type: module` なので ESM で書く。`defineConfig` / `globalIgnores`(`eslint/config`)を使う。
- `globalIgnores`: `dist/`、`coverage/`、`.claude/`、`.kiro/`、`.vscode/`、`server/node_modules/`(最後は既定除外と重複するが明示)。flat config は `.gitignore` を読まないため必須で、特に `.claude/worktrees/` に全コピーが入る([[eslint-flat-config-ignores]])。
- 設定ブロック(すべて `extends: [js.configs.recommended]`):
  - `js/**/*.js`: `globals.browser`。
  - `tests/**/*.js`: `globals.browser` + `globals.node` + `globals.jest`。
  - `server/**/*.js` と `*.config.js`(ルート直下の `vite.config.js`・`jest.config.js`・`eslint.config.js`): `globals.node`。
- `import.meta` は構文なので追加設定不要。`import.meta.env` を使う `js/config.js` / `js/app-controller.js` も lint 対象に含めてよい([[import-meta-env-in-jest]] は Jest 実行の話で Lint は静的解析のため無関係)。
- `@jest/globals` から `jest` を import する 6 ファイルと `globals.jest` の干渉は、実測で報告されなかった。tests 用 globals から `jest` を外す必要はない([[jest-esm-globals]] の方針どおり import を維持)。
- 実行コマンドは `npm run lint`(= `eslint . --max-warnings 0`)。警告も 0 を要求して「警告の蓄積」を防ぐ。recommended は error のみなので現状は挙動差なし。

#### Lint 導入の decision(段階導入の扱い)

loop-basic の `process/verification.md`「静的解析・自動チェックの考え方」(既存の違反を抱えたまま入れるときは report 段階を経て blocking に上げる)に照らした決定。本リポジトリでは **初日から blocking(ルールは error、`--max-warnings 0`)で導入する**。理由は、既存違反が実測で 1 件(`rafSpy`、`no-unused-vars`)だけで、同じ PR 内で解消するため、report(警告のみ・落とさない)段階を置く必要がなく、blocking にしても CI が最初から赤になることがないから。

将来ルールを追加するときの運用:
- 新ルールは、まず `warn` で入れて指摘をゼロにしてから `error` に昇格する。
- ただし `--max-warnings 0` のもとでは **warn も CI(`npm run lint`)を落とす**。したがって「warn で入れて様子を見る」ことはできない。新ルールは、(a) 手元で指摘ゼロを確認してから入れる、または (b) 解消に時間がかかる分は一時的にファイル単位で `off`(`files` を指定した設定ブロックで該当ルールを `off`)にして入れ、解消後にそのブロックを外す、のどちらかで入れる。
- ESLint のメジャー更新で recommended にルールが追加された場合も同様(更新 PR 内で指摘ゼロにする)。

### 既存違反の修正

`tests/unit/slot-machine.test.js:300` の `const rafSpy = jest.spyOn(window, 'requestAnimationFrame')...` が未使用(`no-unused-vars`)。同テストは `cancelSpy.mockRestore()`(L324)だけを復元しており、`requestAnimationFrame` のスパイは復元されていない。対処は **`rafSpy` を残して L324 の前後に `rafSpy.mockRestore()` を追加**する(変数が使われるので違反が消え、かつスパイの復元漏れも直る)。テストの意味は変えない。代案(`const rafSpy =` を外し代入を捨てる)は復元漏れが残るため採らない。

### 検証用 composite action(`.github/actions/verify/action.yml`)

- `runs.using: composite`、入力なし。呼び出し側ジョブが先に `actions/checkout` を実行する(`uses: ./...` のローカル action は checkout 後でないと解決できないため)。
- 各 `run` ステップには `shell: bash` を必ず付ける(composite の必須指定)。
- ステップ(順序固定):
  1. `actions/setup-node@v7`: `node-version-file: package.json`、`check-latest: true`、`cache: npm`、`cache-dependency-path` に `package-lock.json` と `server/package-lock.json` を 2 行で明示列挙(ワイルドカードは `node_modules` 内の lock を拾う恐れがあるため使わない)。
  2. `npm ci`
  3. `npm ci --prefix server`(依存解決の確認を兼ねる)
  4. `npm run lint`
  5. `node --check server/index.js`(構文のみ。server/ の自前ファイルは現状この 1 つ)
  6. `npm test`
  7. `npm run build`、`env: VITE_API_URL: https://example.invalid`(ステップ単位の env。secrets は使わない = fork PR でも動く)
  8. モック混入チェック(下記)
- **Node の指定方式: `node-version-file: package.json` を採用**。理由: `engines.node: "24.x"` が単一の正で、将来 Node のメジャーを上げるとき package.json(と server/package.json)の変更だけで CI も追従する。`node-version: '24'` の明示だと更新時に workflow 側の修正漏れが起きうる。`engines` は ルート・server/ とも `24.x` で同一。`check-latest: true` は既存 deploy.yml と同じ挙動(Node 24 内の最新)を検証側にも揃えるために維持する(検証した Node と本番ビルドの Node をずらさない)。
- **モック混入チェックの仕様**(project-dev.md の手順に準拠):
  - 前提確認: `dist/index.html` が存在すること。無ければ失敗(ビルドが空/失敗したのに grep が 0 件で通る事故の防止)。
  - 対象: `dist/` を再帰し `*.js` と `*.html` に限定(`*.map` は対象外。ソースマップはソース全文を含むため)。パターンは `【モック】|mock-badge`。
  - `grep -rlE` の終了コードを明示的に扱う(落とし穴): 0 = 見つかった → 失敗、1 = 0 件 → 成功、2 以上 = grep 自体のエラー → 失敗。`run:` は `bash -e` なので、`grep` を素で書くと「0 件で失敗、見つかって成功」の逆になる。`if grep ...; then fail; fi` の形だと終了コード 2(ディレクトリ不在等)も成功側に流れるため、終了コードを変数に取って分岐する。
  - 追加チェック: `find dist/assets -iname '*mock*'` が 0 件。`dist/assets/` が無い場合は失敗。
  - 失敗時は該当ファイル名を出力して `exit 1`。

### ci.yml

- `name: CI`、`on: pull_request: branches: [main]` と `push: branches: [main]`。paths フィルタなし。
- `permissions: contents: read`(最小)。
- `concurrency`: group は `ci-${{ github.ref }}`、`cancel-in-progress: ${{ github.event_name == 'pull_request' }}`(PR の追い push では古い実行を打ち切り、main push の実行は打ち切らない)。deploy.yml の `pages` グループとは別。
- ジョブ: ジョブ ID `verify`、`name: verify`(**この文字列がブランチ保護の必須チェック名。変更禁止**)、`runs-on: ubuntu-latest`、`timeout-minutes: 10`。steps は `actions/checkout@v7` → `uses: ./.github/actions/verify`。
- 他のワークフローに `verify` という名前のジョブを作らない(必須チェック名が曖昧になるため)。

### deploy.yml の変更

- ワークフロー全体の `permissions`(contents: read / pages: write / id-token: write)と `concurrency: pages`(`cancel-in-progress: false`)、トリガー(`push: main`・`workflow_dispatch`)は変更しない。
- 新ジョブ `pre-deploy-verify`(`name: pre-deploy-verify`。ci.yml の `verify` と別名にする): job レベルで `permissions: contents: read` に絞る(ワークフロー全体の `id-token: write` を検証ジョブに持たせない)。steps は `actions/checkout@v7` → `uses: ./.github/actions/verify`(composite 内の setup-node は npm キャッシュを使う)。
- `build` ジョブに `needs: pre-deploy-verify` を追加。`deploy` は従来どおり `needs: build`。
- `build` ジョブ内: `actions/checkout@v7`、`actions/setup-node@v7`(`node-version-file: package.json`、`check-latest: true`。**`cache: 'npm'` は外す**)、`actions/configure-pages@v6`、`actions/upload-pages-artifact@v5`、`deploy` の `actions/deploy-pages@v5`。ビルドは従来どおり `secrets.VITE_API_URL` の本物の値(検証ジョブのダミービルドとは別物。Pages に上がるのは `build` の成果物のみ)。
- **`build` ジョブでは npm キャッシュを使わない(決定)**: `build` は `id-token: write`・`pages: write` を持つ権限の強いジョブで、`pre-deploy-verify`(権限の弱いジョブ)が保存した npm キャッシュを復元すると、キャッシュ汚染を通じて強い権限のジョブにコードを持ち込まれる経路になる。setup-node も publish 系ワークフローでのキャッシュ無効化(`package-manager-cache: false`)を推奨している。`cache: 'npm'` を外せばその経路が断たれる。ルートの `package.json` に `packageManager` フィールドが無いので、setup-node v5 以降の「`packageManager` による自動キャッシュ有効化」も働かない(v6 以降は自動キャッシュ対象が npm に限られるが、`packageManager` が無ければそもそも有効にならない)。代償は `build` の `npm ci` がキャッシュなしで少し遅くなること(数十秒)。
- **main push 時の ci.yml と deploy.yml の重複実行は許容**(案C1)。理由: ① deploy が ci.yml の結果に依存しない自己完結の構成(`workflow_run` は default ブランチ文脈・concurrency との整合が複雑)、② 検証は数分で、公開リポジトリのため Actions 無料枠の消費は問題にならない、③ main 上の CI 状態が push ごとに残り可視化される。ci.yml を PR のみにする案(C2)は方針 1 に反するため採らない。

### action の更新と破壊的変更(確認できた範囲)

| action | 旧 → 新 | 確認できた情報 / 状態 |
| --- | --- | --- |
| checkout | v4 → v7(7.0.1) | 確認済み。v5 で Node 24 化(ランナー v2.327.1 以上。GitHub ホストの ubuntu-latest は満たす)、v6 で認証情報の保存先変更、v7 で `pull_request_target`/`workflow_run` の fork PR checkout をブロック。本リポジトリの使い方(入力なし)に影響なし |
| setup-node | v4 → v7(7.1.0) | 確認済み。v5 で `package.json` の `packageManager` があるとキャッシュ自動有効(本リポジトリは `packageManager` なし)、v6 で自動キャッシュを npm に限定、v7 は ESM 移行と `NODE_AUTH_TOKEN` ダミー削除。入力名(`node-version-file`・`cache`・`cache-dependency-path`・`check-latest`)の変更はリリースノートに無い |
| configure-pages | v4 → v6(6.0.0) | 確認済み。v5 の破壊的変更は `static_site_generator: next` のみ、v6 は Node 24 化。入力なしで使うので影響なし |
| upload-pages-artifact | v3 → v5(5.0.0) | 確認済み。v4 で隠しファイル(dotfile)を既定で除外、v5 で `include-hidden-files` 入力追加と upload-artifact v7 化。`npm run build` の `dist/` に dotfile は無い(ローカルで `find dist -name ".*"` が 0 件、`public/` も無い)ので影響なし |
| deploy-pages | v4 → v5(5.0.1) | 確認済み。v5 は Node 24 化のみ。artifact 名の既定(`github-pages`)は upload-pages-artifact と対で動く |

上記はオーケストレーターが設計フェーズ中に `gh release view` で各メジャーの Release を確認した結果(2026-10-22)。実装時の再確認は不要。deploy.yml はマージ後にしか実デプロイで検証できないため、不明点が残る場合は deploy.yml の action 更新だけを別 PR に分ける選択肢をゲートで再確認する(下記リスク参照)。

### ブランチ保護(PR マージ後に実行する手順。implementer の作業ではない)

前提: ① ci.yml を含む PR が main にマージされ、main 上で `verify` が一度成功している、② `gh repo view` で PUBLIC であることを再確認(実測済み)、③ ユーザーが実行を承認済み、④ `gh` は管理者権限のユーザーでログイン済み。

方式: classic branch protection(案D1)。`checks` を使う(`contexts` は廃止予告つき)。入力 JSON を一時ファイル(スクラッチ領域、リポジトリ外)に作り `--input` で渡す。

設定 JSON:

```json
{
  "required_status_checks": {
    "strict": false,
    "checks": [{ "context": "verify" }]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null
}
```

実行: `gh api -X PUT repos/yt-glaceon/roulette/branches/main/protection --input <JSON ファイル>`(`app_id` は省略 = 直近にそのチェックを提供した App を自動選択)。

確認: `gh api repos/yt-glaceon/roulette/branches/main/protection` で `required_status_checks.checks[0].context == "verify"`、`required_pull_request_reviews.required_approving_review_count == 0`、`enforce_admins.enabled == false` を確認。続けて(任意)テスト用の小さな PR で、`verify` 完了前は `gh pr merge` が拒否され、緑になれば通ることを確認する。

各値の理由:
- `strict: false`: 一人運用で、他の PR が main に入るたびに更新と再 CI を要求されるのを避ける。
- 承認数 0: 自分の PR を自分で approve できないため。PR 必須だけを維持する。
- `enforce_admins: false`: CI 自体が壊れたときに `gh pr merge --admin` で突破できる逃げ道を残す。`true` だと CI の修正自体が CI 通過を要してデッドロックしうる。
- force push・ブランチ削除は既定で拒否のため明示不要。

運用への影響(project-dev.md に明記する): `gh pr merge` は `verify` 完了前は失敗する。release 時は `gh pr checks --watch` で緑を待ってからマージするか `gh pr merge --auto` を使う。main への直接 push は(管理者は可能だが)行わない。

## 実装ステップ

依存関係と触るファイルが重ならない 4 タスクに分け、A・B・C・D は並列に dispatch できる(B・C・D は A の成果物を「契約」として参照するだけで、ファイルは重複しない)。E は A〜D の統合後に行う。契約: npm スクリプト名 `lint`、composite action のパス `.github/actions/verify`(入力なし)、必須チェック名 `verify`、deploy 側検証ジョブ名 `pre-deploy-verify`。

### タスク A: ESLint 導入と既存違反の修正(触るファイル: `package.json`、`package-lock.json`、`eslint.config.js`、`tests/unit/slot-machine.test.js`)

- [ ] A1: `npm install -D eslint@^10 @eslint/js@^10 globals@^17` を実行。`git diff package-lock.json` が eslint 関連の増分のみであること、`@rollup/rollup-linux-x64-gnu` などプラットフォーム別の optional 依存のエントリが lock から消えていないことを確認(Windows 生成 lock と Linux CI の相性)。
- [ ] A2: `package.json` の scripts に `"lint": "eslint . --max-warnings 0"` を追加。
- [ ] A3: `eslint.config.js` を新設(上記「ESLint 設定」どおり)。
- [ ] A4: `npm run lint` を実行し、違反が `tests/unit/slot-machine.test.js:300` の 1 件だけであることを確認(想定と違う件数ならルールを緩めず報告して設計に差し戻す)。
- [ ] A5: `rafSpy.mockRestore()` を追加して違反を解消。`npm run lint` が 0 件、`npm test` が全件通ることを確認。
- [ ] A6: ignore の確認。**実行ディレクトリは worktree のルート**(`...\.claude\worktrees\ci-actions`)。親リポジトリ(`C:\Users\temo\Documents\product\roulette`)側では実行しない(親には `.claude/worktrees/` の全コピーがあり、確認の目的が worktree 内の ignore 確認なので不要)。worktree ルートで `npx eslint . -f json` を実行し、出力の各 `filePath` に `.claude/`・`dist/`・`coverage/` を含むパスが 1 つも無いこと(`.claude/` が ignore されていること)を確認する。対象ファイル数が 29 前後であることも併せて見る。
- [ ] A7: 編集後は `git status --short` で反映を確認([[python-is-store-stub]])。

### タスク B: composite action と ci.yml(触るファイル: `.github/actions/verify/action.yml`、`.github/workflows/ci.yml` の新規 2 ファイルのみ)

- [ ] B1: `.github/actions/verify/action.yml` を作成(上記仕様どおり。全 `run` に `shell: bash`、モック混入チェックの終了コード分岐、`dist/index.html` 存在確認を含める)。
- [ ] B2: `.github/workflows/ci.yml` を作成(トリガー・permissions・concurrency・ジョブ名 `verify`・timeout)。
- [ ] B3: actionlint を一度実行(Windows ではスクラッチ領域に `rhysd/actionlint` のリリースバイナリを取得して実行。リポジトリには入れない)。composite action の `action.yml` は actionlint の対象外なので、YAML 構文は別途 node 等で読み込めることを確認する。
- [ ] B4: モック混入チェック部分は、使い捨ての偽 `dist/`(スクラッチ領域)に対してローカルで 5 ケース(クリーン / `*.js` に `【モック】` / `*.html` に `mock-badge` / `assets/` に `mock*` ファイル / `dist` 不在)を流し、期待どおりの終了コードになることを確認。

### タスク C: deploy.yml 更新(触るファイル: `.github/workflows/deploy.yml` のみ)

- [ ] C1: `pre-deploy-verify` ジョブを追加(job レベル `permissions: contents: read`、checkout@v7 → `uses: ./.github/actions/verify`)。
- [ ] C2: `build` に `needs: pre-deploy-verify` を追加し、setup-node を `node-version-file: package.json`(+ `check-latest: true`)に変更する。**`cache: 'npm'` は外す**(権限の強い `build` が `pre-deploy-verify` の保存したキャッシュを復元する経路を断つため。上記「deploy.yml の変更」参照)。
- [ ] C3: 既存 action を checkout@v7、setup-node@v7、configure-pages@v6、upload-pages-artifact@v5、deploy-pages@v5 に更新。
- [x] C4: 各 action の Releases で破壊的変更を確認し、結果を本設計書「action の更新と破壊的変更」表に追記(設計フェーズ中にオーケストレーターが実施済み)。
- [ ] C5: actionlint を実行。トリガー・全体 `permissions`・`concurrency: pages` が変わっていないこと(diff で確認)。

### タスク D: 文書・設定の更新(触るファイル: `.claude/loop.config.json`、`docs/process/project-dev.md`、`docs/memory/entries/eslint-flat-config-ignores.md`)

- [ ] D1: `.claude/loop.config.json` の `verify.lint` を `npm run lint` に変更。`deployNote` を「main への push で deploy.yml が走り、`pre-deploy-verify`(lint・テスト・ビルド・モック混入チェック)に通った場合のみ GitHub Pages に本番デプロイされる。PR・main push では ci.yml の `verify` が走り、main は PR 必須かつ `verify` 必須(ブランチ保護)。server/ は自動デプロイされない」の趣旨に更新。JSON として有効であること(node で parse)を確認。`worktree.setup` は変更なし。
- [ ] D2: `docs/process/project-dev.md`: 構成の「TypeScript・Lint・型チェックは未導入」を「TypeScript・型チェックは未導入。Lint は ESLint(`npm run lint`、`eslint.config.js`)」に更新。「検証コマンドの補足」に `npm run lint` と CI(ci.yml の `verify`、composite action `.github/actions/verify`)の説明、必須チェック名 `verify` を変えない注意、モック混入チェックが CI でも自動実行される旨を追記。「注意点」には、**ブランチ保護設定後の運用を先に書く**(`gh pr checks --watch` で CI 緑を待ってから `gh pr merge`、または `--auto`。緊急時のみ `--admin`)。運用記述は保護設定後の状態を前提に先に書く。実際の設定値が設計と食い違った場合のみ、E5 の小 PR で直す。
- [ ] D3: `docs/memory/entries/eslint-flat-config-ignores.md` の「背景」を「実測で eslint@10 + recommended の違反は 1 件(`no-unused-vars`)のみだった」に更新し、`updated` を当日に。`related_topics` は既に `ci-actions` を含む(追記不要)。

### タスク E: 統合検証(A〜D のマージ後、メインまたは tester。順序依存)

- [ ] E1: ルートで `npm ci` → `npm run lint` → `npm test` → `npm run build`(ダミー env)→ モック混入チェックを、composite action と同じ順で手元で通す。
- [ ] E2: feature ブランチを push して PR を作成し、`verify` が緑になることを確認(`gh pr checks --watch`)。Linux での `npm ci`(optional 依存)も初回でここで確認。
- [ ] E3: 負のテスト(下記テスト戦略)を PR 上で実施し、確認後に当該コミットを取り消す。
- [ ] E4: ユーザー確認の上でマージ。マージ後、main の `ci.yml`(push)と `deploy.yml` を `gh run watch` で追い、`pre-deploy-verify` → `build` → `deploy` が成功し Pages が更新されることを確認。
- [ ] E5: ユーザー確認の上でブランチ保護を設定(上記手順)。設定後、実際の設定値が設計(JSON・運用記述)と食い違っていた場合に限り、project-dev.md の運用記述を直す小 PR を、通常どおり PR 経由(`verify` 通過後)でマージする。食い違いが無ければ文書の追加変更は不要(運用記述は D2 で先に書いてある)。

## テスト戦略

ワークフロー自体はローカルで単体テストしづらいため、静的検査 + 実際の CI 実行での確認を基本とする。

合格基準:

- **静的検査**: actionlint が ci.yml・deploy.yml でエラー 0。composite action の YAML が構文として読める。`loop.config.json` が JSON として parse できる。
- **ESLint**: `npm run lint` が終了コード 0(違反 0、警告 0)。対象に `dist/`・`coverage/`・`.claude/` が含まれない(A6 の `-f json` で確認)。
- **既存テスト**: `npm test` が全件通る(slot-machine の修正後も同じ件数)。`npm run build` が成功。
- **PR 上の正常系**: ci.yml が PR で起動し、ジョブ名が `verify` として表示され、全ステップ成功で緑。Linux 上の `npm ci`(ルート・server/)が成功。
- **負のテスト(使い捨て)**: PR のブランチ上で一時コミットを積み、(1) 本番経路で残るコード(例: `js/` の通常実行されるモジュール内の `console.log('【モック】')` と、`mock-badge` を含む文字列リテラルの `console.log`)を入れると `verify` がモック混入チェックで落ちること(コメントは minify で消えるので文字列リテラルにする。**注意**: minify で `【モック】` が `\uXXXX` 形式にエスケープされると grep で検出されない可能性がある。落ちなかった場合は、ビルドした `dist/assets/*.js` の実際の表記を確かめ、grep パターンを見直す(エスケープ表記も拾う、または `mock-badge` 側で担保する)。`mock-badge` は ASCII なのでエスケープされない)、(2) lint 違反(未使用変数)を入れると lint ステップで落ちること、(3) どちらも元に戻すと再び緑になること。確認後に一時コミットを revert して履歴に影響が残らないようにする(マージ前に履歴を整理するか、revert コミットで打ち消す)。
- **モック混入チェックのローカル検証**: タスク B4 の 5 ケースが期待どおりの終了コード。
- **deploy.yml(マージ後)**: main push 後に `pre-deploy-verify`・`build`・`deploy` が順に成功し、公開 URL が更新される。検証ジョブを意図的に落として deploy が走らないことの確認は、本番に影響しうるため実施しない(`needs` の標準動作に依拠。actionlint で `needs` の参照整合を確認)。
- **ブランチ保護**: 設定後 GET で値を確認し、`verify` 完了前の `gh pr merge` が拒否されることを確認。

**自動テストを新規作成するか:** しない(理由: 追加・変更するのは CI 設定・ESLint 設定・文書で、アプリのロジックに変更がない。モック混入チェックはシェル手順であり、Jest で扱うには bash 依存の子プロセステストになり脆い。代わりに、偽 dist によるローカル 5 ケース検証と PR 上の負のテストで挙動を確認する。違反修正(slot-machine.test.js)は既存テスト自体の変更で、既存の `npm test` が回帰確認になる。この判断の妥当性はゲートでの確認事項)。

## リスク・トレードオフ

- **deploy.yml はマージ後に初めて実デプロイで検証される**: `push: main` と `workflow_dispatch` のみで、PR 上では deploy が走らない。構文ミスや action の破壊的変更(特に upload-pages-artifact v5・deploy-pages v5・configure-pages v6)で本番デプロイが失敗しうる。緩和: actionlint、Releases での破壊的変更確認、マージ直後の `gh run watch`。失敗しても Pages は直前の成功デプロイのまま(壊れた版が公開されることは通常ない)。なお feature ブランチから deploy.yml を `workflow_dispatch` するとブランチの成果物が本番に公開されうるため、マージ前の動作確認としては行わない。
- **action 更新を同じ PR に含めるトレードオフ**: 一括で揃う利点と、デプロイ失敗時の切り分けが難しくなる欠点。破壊的変更の確認結果次第で、deploy.yml の action 更新だけを別 PR に分ける(その場合 `pre-deploy-verify` の追加だけ先に出す)。
- **main push の重複実行**: 同じ検証が 2 回走る(許容)。
- **composite action の制約**: 呼び出し側で checkout が必須、各 run に `shell` 指定。verify のステップ追加はこの 1 ファイル。ジョブの permissions・runs-on は各ワークフロー側に残る。
- **Node 指定が 2 箇所にある(意図的な重複)**: composite action 内の setup-node と、deploy.yml の `build` ジョブの setup-node はそれぞれ `node-version-file: package.json` + `check-latest: true` を書く。`build` は npm キャッシュを使わず設定が異なる(キャッシュ有無)ため composite を再利用せず、意図的に別記述にしている。両者とも同じ `package.json` の `engines.node` を参照するので、Node の版そのものは 1 箇所で決まる。
- **必須チェック名 `verify` の固定**: 名前を変えると保護と食い違いマージ不能になる(レビュー項目、project-dev.md に注意書き)。ci.yml 以外に `verify` という名のジョブを作らない。
- **ブランチ保護の運用コスト**: `gh pr merge` が CI 待ちになる。承認数 0 / `enforce_admins: false` は一人運用の利便性優先で、管理者は保護を迂回できる(意図的)。
- **Windows 生成 lock と Linux CI の optional 依存**: 過去に `npm ci` が失敗した既知の問題あり。A1 で lock の差分確認、E2 の初回 CI で確認。
- **ESLint 10 の新ルール**(`preserve-caught-error` 等)は現コードでは未検出だが、今後のコードで出うる。`--max-warnings 0` のため warn でも CI が落ちる点を含め、追加時の運用は「Lint 導入の decision」に従う。
- **npm キャッシュと OIDC**: `build` ジョブは `id-token: write` を持つため npm キャッシュを使わない(`cache: 'npm'` を外す)。検証ジョブ(`pre-deploy-verify`)は `contents: read` に絞り、キャッシュを使う。権限の弱いジョブが保存したキャッシュを強いジョブが復元する経路を断つ構成。代償は `build` の `npm ci` が数十秒遅くなること。

## ロールバック方針

- **ci.yml・composite action・ESLint(PR マージ前)**: PR を閉じるだけでよい。
- **マージ後に deploy.yml が失敗する場合**: `git revert` で deploy.yml(と必要なら composite action 呼び出し)を戻す PR を出し、マージして再デプロイ。直前の Pages は残っているため公開物は無傷。緊急時は保護の `enforce_admins: false` により `gh pr merge --admin` が使える。deploy.yml の action 更新だけが原因なら、`pre-deploy-verify` は残して action のバージョンだけ戻す部分 revert にする。
- **CI が常に落ちて開発が止まる場合**: ブランチ保護の必須チェックを一時的に外す(`gh api -X DELETE repos/yt-glaceon/roulette/branches/main/protection/required_status_checks`)、または保護全体を解除(`gh api -X DELETE repos/yt-glaceon/roulette/branches/main/protection`)してから原因を直す。管理者は `--admin` でも突破できる。
- **ESLint が重荷になった場合**: `verify.lint` と ci の lint ステップ・`eslint.config.js`・devDependencies を外す revert で戻せる(アプリ本体のコードは slot-machine.test.js の 1 行以外変えていない)。

## 設計レビュー結果

`design-reviewer` による自動レビュー(最大2ラウンド、`/design` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | MAJOR | MAJOR(M1: Lint 段階導入の decision 欠落)、MINOR 6 件。反映済み: M1 は「Lint 導入の decision」節を追記、m1 は B4 のケース数を 5 に統一、m2 は負のテストに `mock-badge` 併用と `\uXXXX` エスケープ時の見直しを追記、m3 は A6 を `-f json` の filePath 確認に具体化、m4 は D2 で運用を先に書き E5 は食い違い時のみ修正に変更、m5 はリスク節に Node 指定の意図的重複を注記、m6 は `build` ジョブの `cache: 'npm'` 廃止を決定として反映 |
| 2 | PASS | M1・m1〜m6 の解消を確認。MINOR 3 件: n1(D2 の最終文が曖昧)と n3(やること 4 にキャッシュ廃止が無い)はオーケストレーターが修正。n2(`build` のキャッシュ廃止は壁打ち後の判断)はゲート1でユーザーに提示 |

未解決のMAJORが残った場合: なし

## コードレビュー結果

`code-reviewer` による自動レビュー(最大2ラウンド、`/implement` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS / MAJOR |  |
| 2(ラウンド1がMAJORの場合のみ) | PASS / MAJOR |  |

未解決のMAJORが残った場合: (なければ「なし」。テストレポートにも引き継ぐこと)

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 承認 | 壁打ち後に決めた build ジョブの npm キャッシュ廃止も含めて承認。設計レビューは2ラウンドで PASS |

## 適用した共有メモリ

- [[eslint-flat-config-ignores]]、[[jest-esm-globals]]、[[import-meta-env-in-jest]]、[[python-is-store-stub]](いずれも `related_topics` に `ci-actions` を記載済み。各エントリの related_topics は 1〜2 件のため、スキル化候補の基準(3 件以上)には達していない)。

## 壁打ち(grilling)の記録

2026-10-22 にユーザーと確認した論点(いずれも設計の既定案どおりで確定、設計の変更なし)。

- deploy.yml の action 更新(checkout v7 ほか)は CI 追加と**同じ PR** に含める。破壊的変更はリリースノートで確認済みで、本リポジトリへの影響なし(「action の更新と破壊的変更」表)。
- main push 時の ci.yml と deploy.yml の**二重実行は許容**する。
- ブランチ保護の値は既定案どおり(PR 必須・承認数 0・必須チェック `verify`・`enforce_admins: false`・`strict: false`)。
- CI 設定そのものの**自動テストは新規作成しない**。actionlint と、PR 上でわざとモック/lint 違反を入れて落ちることの確認で代える(確認用コミットはマージ前に取り消す)。
- スキル化候補: なし。
