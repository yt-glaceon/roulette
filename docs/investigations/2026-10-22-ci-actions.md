# 調査: GitHub Actions で CI を追加する(ESLint 導入・deploy 前検証・ブランチ保護)

- 日付: 2026-10-22
- ステータス: 完了(ESLint の違反件数と visibility はオーケストレーターが追加で実測済み。「追加の実測結果」参照)
- 関連する設計ドキュメント: [docs/designs/2026-10-22-ci-actions.md](../designs/2026-10-22-ci-actions.md)

## 背景・目的

main への push で GitHub Pages に本番デプロイされるが、テスト・ビルド検証・Lint は PR 段階でも deploy 前でも走らない。次の方針(ユーザーと決定済み)を実現するための事実と選択肢を整理する。

1. `.github/workflows/ci.yml` を新設(main 向け `pull_request` と main への `push`)。
2. `deploy.yml` の build の前に test ジョブを置き(`needs`)、落ちたらデプロイしない。`concurrency: pages` は維持。
3. 検証: `npm test`、`npm run build`(ダミー `VITE_API_URL`)、ビルド成果物へのモック混入チェック、server/ の最低限チェック(`npm ci --prefix server` と `node --check`)、ESLint。
4. ESLint を flat config + `@eslint/js` recommended で新規導入(対象は js/・tests/・server/)。既存の違反は直す。`.claude/loop.config.json` の `verify.lint` も設定。Prettier・型チェックは入れない。
5. Node は 24。
6. PR マージ後に main のブランチ保護(PR 必須・CI 通過必須)を `gh api` で設定。必須チェックのジョブ名は固定、paths フィルタは使わない。

## 調査の制約(重要)

この調査を担当したエージェントの環境には Bash/PowerShell 実行ツールが無く、次ができなかった。

- **ESLint を実際に流しての違反件数の計測**(依頼の「特に調べてほしいこと」の 2 点目)。
- `gh repo view` によるリポジトリの visibility・権限の確認。

代わりに Grep によるソースの静的確認と公式ドキュメント・npm レジストリ・GitHub API(web)の参照で補った。

### 追加の実測結果(オーケストレーターが調査の後に実施)

- **ESLint の違反**: scratchpad に `eslint@10`・`@eslint/js@10`・`globals@17` を入れ、リポジトリ外の flat config(recommended + js/=browser、tests/=browser+node+jest、server/ と `*.config.js`=node、`dist`・`node_modules`・`coverage`・`.claude`・`.kiro` を ignore)を `-c` で渡して `js tests server/index.js vite.config.js jest.config.js` を検査した。**29 ファイル中、違反は 1 件だけ**: `tests/unit/slot-machine.test.js:300` の `no-unused-vars`(`rafSpy` が未使用)。`preserve-caught-error` などの新ルールや、`@jest/globals` の `jest` import と `globals.jest` の干渉は報告されなかった。ルールの緩和は不要。
- **visibility**: `gh repo view` で `yt-glaceon/roulette` は **PUBLIC**。Free プランでもブランチ保護が使える。
- **action の最新版**: `gh api repos/<owner>/<repo>/releases/latest` で checkout v7.0.1、setup-node v7.1.0、configure-pages v6.0.0、upload-pages-artifact v5.0.0、deploy-pages v5.0.1 を確認(下の表と一致)。

以下の本文で「未計測」「推測」とある記述は、この実測結果で置き換えて読むこと。

## 現状の把握

### リポジトリ構成(worktree 内で確認)

- ルート `package.json`: `type: module`、`engines.node: "24.x"`、devDependencies は `@jest/globals`・`fast-check`・`jest`・`jest-environment-jsdom`・`vite`。ESLint は無い。`scripts` は `dev` / `build`(`vite build`)/ `test`(`node --experimental-vm-modules node_modules/jest/bin/jest.js`)等。`lint` スクリプトは無い。
- `server/package.json`: `type: module`、`engines.node: "24.x"`、依存は discord.js・express・cors・dotenv。スクリプトは `start` と `dev` のみ。lock は `server/package-lock.json`。
- **server/ の自前ファイルは `server/index.js` 1 つだけ**(ほかは `package.json`・lock・`.gitignore`・`README.md`・git 管理外の `.env`・`node_modules`)。`node --check server/index.js` で足りる。将来ファイルが増えても拾えるよう `git ls-files 'server/*.js'` や `find server -name '*.js' -not -path '*/node_modules/*'` を回す形にもできるが、現状は 1 ファイル固定で十分。`node --check` は構文のみで、import 解決や実行はしない(依存の `npm ci --prefix server` が通ることとは別の確認)。
- js/: `app-controller.js`・`config.js`・`discord-client.js`・`result-manager.js`・`roulette-engine.js`・`ui-controller.js`、`animations/`(5 ファイル)、`dev/`(`mock-badge.js`・`mock-data.js`・`mock-discord-client.js`)。
- tests/unit/: 12 ファイル。うち `@jest/globals` から `jest` を import するのは 6 ファイル(drum-roll・card-flip・ui-controller・slot-machine・roulette-wheel のほか1つ程度)。`describe` / `it` / `expect` / `beforeEach` は **import されずグローバルのまま**使われている(Jest は ESM 実行でもこれらは注入する。`jest` だけが無い。[[jest-esm-globals]])。`fast-check` は `import fc from 'fast-check'`。`Object.prototype.hasOwnProperty.call(...)` を使っており `no-prototype-builtins` には引っかからない形。
- `jest.config.js` は `export default {...}`(ESM)で `testEnvironment: 'jsdom'`。`vite.config.js` も ESM。どちらも `process` 等のグローバルは使わないため、特別な globals 無しで lint できる見込み(念のため設定ファイル群に node globals を付けるのは害が無い)。
- `.github/workflows/deploy.yml`: トリガーは `push: main` と `workflow_dispatch`。`permissions` はワークフロー全体で `contents: read` / `pages: write` / `id-token: write`。`concurrency: group: "pages"`、`cancel-in-progress: false`。build ジョブ(checkout@v4、setup-node@v4 の `node-version: '24'` + `check-latest: true` + `cache: 'npm'`、`npm ci`、`npm run build` に `VITE_API_URL: ${{ secrets.VITE_API_URL }}`、configure-pages@v4、upload-pages-artifact@v3)と deploy ジョブ(`needs: build`、deploy-pages@v4)。
- `.claude/loop.config.json`: `verify.lint` は `null`、`verify.test` = `npm test`、`verify.build` = `npm run build`。`worktree.setup` は `npm ci` と `npm ci --prefix server`。`productPaths` は `["*"]`。`deployNote` に deploy.yml の説明があり、CI 追加後は更新対象になりうる。
- `docs/process/project-dev.md` に「TypeScript・Lint・型チェックは未導入」という記述がある(ESLint 導入後は更新が必要)。モック混入確認の手順も同ファイルにある。
- `.gitignore` に `node_modules/`・`coverage/`・`dist/`・`.claude/worktrees/` が入っている。**ESLint の flat config は `.gitignore` を読まない**(`ignores` に明示が必要。既定の除外は `**/node_modules/` と `.git/` のみ)。

### import.meta.env の扱い

- `js/app-controller.js`(`import.meta.env.DEV` ×2)と `js/config.js`(`import.meta.env.VITE_API_URL`)で使用。ESLint の `languageOptions.ecmaVersion` は flat config の既定が `latest`、`sourceType` は `.js` で `module` が既定なので、**`import.meta` は構文エラーにならず、`no-undef` にも掛からない**(`import.meta` はグローバル変数ではなく構文)。追加の設定は不要。
- Jest では `import.meta.env` が undefined になるため、これらのファイルはテストから直接 import されていない([[import-meta-env-in-jest]])。Lint は静的解析のみなので影響しない。

### ビルド・モック混入チェック

- `npm run build` が参照する環境変数は `VITE_API_URL` のみ(`js/config.js`。`vite.config.js` の `envPrefix: 'VITE_'`、`.env.example` にも `VITE_API_URL` のみ)。未設定でもビルド自体は通り、実行時に `console.error` してフォールバックするだけ。ダミー値(例 `https://example.invalid`)で問題ない。ルートの `.env` は git 管理外なので CI には存在しない(= `VITE_API_URL` を env で渡す形でよい)。
- `vite.config.js` は `base: '/roulette/'`、`sourcemap: true`。**ソースマップ(`*.map`)にはソース全文が入るので、`【モック】` 等が含まれうる**。project-dev.md が「`*.map` は対象外」としているのはこのため。
- モック混入チェックの grep 対象: `dist/` 全体を再帰し `*.js` と `*.html` に限定(`grep -rlE '【モック】|mock-badge' dist --include='*.js' --include='*.html'` が 0 件)。加えて「`dist/assets/` に名前に `mock` を含むファイルが無い」(`find dist/assets -iname '*mock*'` が 0 件)も project-dev.md の手順に含まれる。assets のみに絞るより dist 全体(`*.html` も含む)が手順に忠実。
- grep は「0 件ならゼロ終了」の向きが逆なので、シェルで `if grep -rlE ...; then echo ...; exit 1; fi` の形にする必要がある(`grep` は 0 件のとき終了コード 1。`run:` はデフォルトで `bash -e` 相当なので、そのまま書くと「見つかったとき成功、見つからないとき失敗」になる)。設計時の落とし穴として明記する。
- 本番で `import.meta.env.DEV` が `false` に置換され、`import('./dev/...')` の動的 import ごと除去される想定で、既存のテスト記録(`docs/tests/2026-10-21-dev-mock-members.md`)でも手動確認済みの前提。CI 化はその自動化にあたる。

## ESLint に関する事実

- **現行メジャーは ESLint 10 系**(2026-10-22 時点の npm `latest` は 10.13.0)。`engines` は `^20.19.0 || ^22.13.0 || >=24` で **Node 24 は対応**。`@eslint/js` の latest は 10.0.1(同じ engines)、`globals` の latest は 17.13.0(Node >=18)。
- ESLint 9 は maintenance 扱い。`.eslintrc` は 10 で完全に廃止されており、flat config のみ。
- **ESLint 10 で `eslint:recommended` に追加されたルール**: `no-unassigned-vars`、`no-useless-assignment`、`preserve-caught-error`。既存コードで引っかかりうるのは主に次の 2 つ。
  - `preserve-caught-error`: `catch (e) { throw new Error('...') }` のように、キャッチしたエラーを `cause` に渡さず新しいエラーを投げると報告される。`js/discord-client.js`・`js/result-manager.js` などに catch が各 4〜5 箇所あり、`throw new Error(...)` を含む形なら報告されうる(未実測)。
  - `no-useless-assignment`: 値を代入したが後で使われない変数。ES5 風の初期化(`let x = null; x = ...`)に出やすい。
- 従来から recommended に入っているもので既存コードに出やすいのは `no-unused-vars`(ESLint 9 以降 `caughtErrors: "all"` が既定。`catch (error)` の `error` を使っていない catch が報告される)、`no-empty`(空の catch)、`no-undef`(globals 未設定のとき)、`no-prototype-builtins`、`no-useless-escape`、`no-case-declarations`。
- 設定の書き方(公式ドキュメントの形):

  ```js
  // eslint.config.js(ルートは type: module なので ESM のまま書ける)
  import js from '@eslint/js';
  import globals from 'globals';
  import { defineConfig, globalIgnores } from 'eslint/config';

  export default defineConfig([
    globalIgnores(['dist/', 'coverage/', '.claude/', '.kiro/', 'server/node_modules/']),
    { files: ['js/**/*.js'], extends: [js.configs.recommended],
      languageOptions: { globals: globals.browser } },
    { files: ['tests/**/*.js'], extends: [js.configs.recommended],
      languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.jest } } },
    { files: ['server/**/*.js', '*.config.js'], extends: [js.configs.recommended],
      languageOptions: { globals: globals.node } },
  ]);
  ```

  (上記は書き方の例示であり設計の確定ではない。`globalIgnores` は `ignores` のみの設定オブジェクトでも代替可。ignore は `node_modules` が既定で除外されるため `server/node_modules` は明示不要だが、書いても害は無い。)
- 環境指定は `globals` パッケージ(`globals.browser` / `globals.node` / `globals.jest`)で行う。`eslint-env` コメントは ESLint 10 ではエラー。
- **tests/ に付ける globals**: `describe`/`it`/`expect`/`beforeEach` 等は `globals.jest` で定義される。jsdom 環境で `window`/`document` を使うので `globals.browser` も必要。ESM で `import { jest } from '@jest/globals'` する 6 ファイルは `globals.jest` に `jest` も含まれるが、ESM のモジュールスコープでの import は `no-redeclare`(`builtinGlobals`)の対象外になる見込み(要実測。万一報告されたら tests 用 globals から `jest` だけ除くか、`no-redeclare` を調整)。
- `process`/`Buffer` 等を tests で使っていれば `globals.node` が必要だが、使っていなくても付けて害は無い。
- `@eslint/js` と `globals` は `eslint` とは別パッケージで、devDependencies に 3 つ(`eslint`・`@eslint/js`・`globals`)追加が必要。`eslint` の `defineConfig` / `globalIgnores`(`eslint/config`)は ESLint 9.22 以降で利用可能。
- Lint の実行コマンド案: `npx eslint .`(ルートの設定が js/・tests/・server/ を網羅)。`package.json` に `"lint": "eslint ."` を追加し、`verify.lint` は `npm run lint`。サブディレクトリ `server/` から実行しても v10 は「リンク対象ファイルのディレクトリから上に向かって `eslint.config.*` を探す」ので、ルートの設定が見つかる。

### ESLint の実測手順(未実施、実装の最初に行う)

リポジトリを汚さない方法の例(検証時の参考。この調査では実行できていない)。

```
# スクラッチ領域にインストール(リポジトリ外)
mkdir <scratch>/eslint-try && cd <scratch>/eslint-try
npm init -y && npm i eslint@10 @eslint/js@10 globals@17
# リポジトリを cwd にして、リポジトリ外の設定を --config で渡す(config の import が解決できるよう scratch 側に置く)
cd <worktree> && node <scratch>/eslint-try/node_modules/eslint/bin/eslint.js -c <scratch>/eslint-try/eslint.config.js js tests server/index.js
```

注意点: リポジトリ外に置いた設定は `import` の解決元が scratch 側になるので、依存はそちらに入れる。`--config` を渡すと v10 でもその設定がそのまま使われる。または、実装フェーズで正式に devDependencies を入れて実測してもよい(その場合の「痕跡」は成果物そのもの)。

### 静的に確認できた範囲での違反予測

- `server/index.js`: import 5 つはすべて使用、`catch (error)` 5 箇所すべて `console.error` で使用、`no-undef` 対象は `process`・`console`・`setInterval` などで `globals.node` で解決。**違反はほぼ無い見込み**。
- js/・tests/: 件数は未計測。catch ブロックは js/ に 20 箇所前後(app-controller 5、ui-controller 5、discord-client 5、result-manager 4、…)。`error` を使っていない catch・空 catch があれば `no-unused-vars`・`no-empty` に出る。クラスの未使用 import(例: `ui-controller.js` の 4 つのアニメーション import はいずれも使われている前提)は未確認。
- 以上から、**規模は「数件〜数十件、ほとんどが機械的に直せる(未使用変数の削除・catch の `catch {` 化・`cause` 付与)」** と見積もるが、これは推測で、実測が必要。ルールを緩めるかの判断も実測後。

## 選択肢の比較

### A. ESLint のバージョン

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A1: ESLint 10 系 + @eslint/js 10 + globals 17 | 現行メジャー。Node 24 対応。長期保守される。flat config 前提で書ける | recommended に 3 ルール追加(`preserve-caught-error` など)で初回の違反が少し増えうる | 公式の 10 移行ガイドで影響は小さいと読める |
| 案A2: ESLint 9 系 | 新ルールが無く違反が少し減る可能性 | maintenance 扱いで、いずれ移行が必要。新規導入で古い版を選ぶ理由が弱い | 9.39.x まで出ている |

### B. deploy.yml と CI の検証手順の共有

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案B1: 重複記述(ci.yml と deploy.yml の test ジョブに同じ steps を書く) | 仕組みが単純。ジョブ名・permissions を各ワークフローで独立に制御できる | 検証を変えるとき 2 箇所の修正が必要で、食い違うと「CI は緑なのに deploy 前は別の検証」になる | 小規模なら許容されるが、モック混入チェックなど手順が長い |
| 案B2: 再利用ワークフロー(`on: workflow_call`、deploy.yml から `jobs.test.uses: ./.github/workflows/ci.yml`) | 定義が 1 箇所。ジョブ単位で呼べる | 必須チェック名が「呼び出し側ジョブ名 / 呼び出されたジョブ名」形式になる(公式ドキュメントで確認できなかった。実例では `test / verify` のように連結される)。ブランチ保護の名前合わせでつまずきやすい。呼び出し側の `permissions` は上限として効く(昇格不可)。`concurrency` や `secrets` の受け渡しの考慮が増える | ci.yml を `workflow_call` 兼用にすると、main push 時に ci.yml 単体でも走る重複も残る |
| 案B3: composite action(`.github/actions/verify/action.yml` に steps を集約、各ワークフローのジョブから `uses: ./.github/actions/verify`) | 手順が 1 箇所で、**必須チェック名は各ジョブ名そのまま**(ci.yml の `verify` ジョブの名前を固定できる)。ジョブの runs-on・permissions は各ワークフローに残せる | composite は `uses: ./` を使うため checkout が先に必要(各ジョブで checkout してから呼ぶ)。composite 内の各 step には `shell: bash` の指定が必要。`${{ secrets }}` は直接参照できず input で渡す(今回はダミー値なので不要) | リポジトリ内の `.github/actions/` に置く。ディレクトリ数が増える |

### C. main push 時に ci.yml と deploy.yml の両方で同じ検証が走る重複への対処

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案C1: そのまま許容(ci.yml は push も受け、deploy.yml も test を回す) | 方針どおり。main 上の CI 結果が常に残り、deploy が必ず自前で検証する(deploy は ci.yml の完了に依存せず独立) | 同じ検証が 2 回走る(個人リポジトリなので Actions 無料枠の消費は小さい。数分/回) | 最も単純で壊れにくい |
| 案C2: ci.yml のトリガーを `pull_request` のみにし、main push の検証は deploy.yml の test に任せる | 重複が消える | 方針 1(main への push でも CI)から外れる。main の CI 状態を示すチェックが push 時に出ない(ただし deploy.yml の test ジョブが代わりになる) | 要ユーザー判断 |
| 案C3: deploy.yml のトリガーを `workflow_run`(ci.yml 完了後)にする | 重複が消え、CI 成功をトリガーにできる | `workflow_run` は常に default ブランチのコンテキストで動くなど挙動が複雑。`concurrency: pages` の扱いや `workflow_dispatch` との整合も要設計。既存構成の変更が大きい | 方針 2(deploy.yml 内で needs)から外れる |

### D. ブランチ保護の方式

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案D1: 従来のブランチ保護(`PUT /repos/{owner}/{repo}/branches/main/protection`) | gh api 1 回で設定できる。必須チェックは `required_status_checks.checks[].context`(+任意 `app_id`)で指定。`enforce_admins`・`required_pull_request_reviews.required_approving_review_count`(0 可)で運用を調整できる | `contexts` は closing down notice 付きなので `checks` を使う。JSON 入力は `--input -` で渡すのが安全(ネスト構造) | 個人リポジトリでは bypass 一覧は設定できず、管理者のバイパスは `enforce_admins` の true/false のみ |
| 案D2: Rulesets(`POST /repos/{owner}/{repo}/rulesets`) | 新方式で表現力が高い(複数ブランチ・ルール単位の有効/無効) | 設定項目が多く、個人リポジトリでは bypass_actors の指定可能範囲が限られる(要確認)。既存の運用メモ(`protectedBranches`)とも直接は対応しない | 今回の要件(1 ブランチ・2 条件)にはやや過剰 |

補足: 保護機能(ブランチ保護・rulesets)は **GitHub Free では public リポジトリのみ**(private は Pro 以上)。リポジトリは `server/index.js` の CORS 許可に `https://yt-glaceon.github.io` があり、GitHub Pages を Free プランで使うには public が必要なことから、**yt-glaceon/roulette は public の可能性が高い**が、`gh repo view` で未確認(要確認)。

- 必須チェックの `context` は **ジョブの `name`(ジョブに `name:` を付けていればその値、無ければジョブ ID)** で、マトリクス無しの場合はその文字列そのもの。ワークフロー名は含まれない。他のワークフローに同名ジョブがあると曖昧になり、マージできなくなる恐れがある(公式)。`app_id` は省略すると「直近にそのチェックを提供した App」を自動選択、`-1` で任意の App を許可。GitHub Actions のチェックは App ID 15368(github-actions)だが、省略で動くので指定しなくてよい。
- 必須チェックは「成功・skipped・neutral」でマージ可能(公式)。つまり **paths フィルタでワークフロー自体が起動しない場合は「保留のまま」になりマージできなくなる**。方針の「paths フィルタは使わない」は正しい。ジョブレベルの `if:` で skip するのも、skipped が成功扱いになる点で弱い保護になるので避ける。
- **初回は、保護を設定する前にチェック名がリポジトリに一度は現れている必要がある**(一度も実行されていない名前は、API では設定できても UI の候補には出ない。API なら設定自体は可能)。「PR マージ後に設定する」順序(= 方針 6)はこの点でも合っている。
- **`gh pr merge` との相性**: 必須チェックが未完了の PR は `gh pr merge` が失敗する(`--auto` を付けると完了待ち)。loop-basic の release でマージが `gh pr merge` なら、(1) マージ前に CI が緑になるのを待つ手順を足す(`gh pr checks --watch`)か `--auto` を使う、(2) 一人運用で自分の PR を自分で approve できないため **`required_approving_review_count` は 0**(PR 必須だけ維持)、(3) 管理者バイパスは `enforce_admins: false` なら `gh pr merge --admin` で緊急時に突破できる。`true` にすると自分も縛られ、CI が壊れた状態の修正自体が PR + CI 通過を要する(デッドロックしうる)。
- `strict`(「マージ前にブランチを最新にする」)は一人運用では `false` が運用しやすい。`true` にすると main に別 PR が入るたびに更新+再 CI が必要。
- force push・ブランチ削除の禁止(`allow_force_pushes: false`、`allow_deletions: false`)は既定で拒否のため明示不要(API の required フィールドの `restrictions: null` は指定が必須)。

## GitHub Actions の action の現行メジャー版(2026-10-22 時点、GitHub Releases の latest)

| action | 現行 | 現在の deploy.yml | 備考 |
| --- | --- | --- | --- |
| actions/checkout | v7(7.0.1、2026-07) | v4 | |
| actions/setup-node | v7(7.1.0、2026-10-08) | v4 | v7 で ESM 移行。`NODE_AUTH_TOKEN` の挙動変更のドキュメントあり(今回は無関係) |
| actions/configure-pages | v6(6.0.0、2026-03) | v4 | |
| actions/upload-pages-artifact | v5(5.0.0、2026-04) | v3 | `include-hidden-files` 入力が追加。内部で upload-artifact v7 を使用 |
| actions/deploy-pages | v5(5.0.1、2026-09) | v4 | |

- 古い版でも動くが、新規の ci.yml は現行メジャーで書くのが自然。deploy.yml の既存 action を上げるかは本トピックの範囲外にもできる(node24-upgrade の調査では deploy.yml の Node 指定のみ扱った)。上げる場合は動作確認(Pages への実デプロイ)が要るので、別トピックに分けるか、deploy.yml を触るついでに揃えるかを設計で決める。
- **setup-node の `node-version-file`**: `package.json` を指定すると `volta.node` → `devEngines.runtime`(name が node のもの)→ **`engines.node`** の順に読む。`engines.node` が `24.x` なので `node-version-file: package.json` で Node 24 の最新が入る(semver 範囲として解釈)。`node-version` と両方指定した場合は `node-version` が優先。ルートと server/ の `engines` が同じ `24.x` なので、どちらを参照しても同じ。「Node の版を 1 箇所(package.json)で管理」できる利点がある。`check-latest: true` は既存 deploy.yml にあり、最新を取りに行って少し遅くなるだけ(Node 24 内の最新に追従したいなら維持、CI の安定重視なら外すのも可)。
- **npm キャッシュ(ルートと server/ の 2 つの lock)**: `cache: 'npm'` と `cache-dependency-path` に複数行で両方の lock を列挙する(`package-lock.json` と `server/package-lock.json`)。ワイルドカード `**/package-lock.json` も可だが、`node_modules` 内の lock を拾わないよう明示列挙が安全。
- **setup-node の自動キャッシュ**: 現行の setup-node は `package.json` の `packageManager` が npm のときにキャッシュを既定で有効にする。このリポジトリの package.json には `packageManager` が無いので該当しないが、明示 `cache: 'npm'` を書くなら問題なし。公式は **公開(publish)系ワークフローではキャッシュ汚染で OIDC トークン等が漏れうるので `package-manager-cache: false` を推奨**している。deploy.yml は `id-token: write` を持つので、deploy.yml の build ジョブでのキャッシュ利用は設計時に判断する(現状は `cache: 'npm'` で運用中)。
- ci.yml の権限は `permissions: contents: read` のみにするのが最小。

## ビルド・検証ステップの要点(設計への入力)

- 順序の案: checkout → setup-node(node-version-file + cache) → `npm ci` → `npm ci --prefix server` → `npm run lint` → `node --check server/index.js` → `npm test` → `npm run build`(`VITE_API_URL: https://example.invalid`)→ モック混入チェック。
- `npm test` は jsdom + fast-check で外部ネットワーク不要(CI 向き)。実行時間は未計測。`fast-check` のランダム性による flake の可能性は低いが、失敗時の seed は出力に出る。
- `server/node_modules` を ESLint が見ないこと(`**/node_modules/` は既定除外)。`npm ci --prefix server` は `node --check` だけならなくても動くが、方針 3 で「最低限チェック」に含まれるので依存解決の確認になる。
- ジョブ名は固定(例: ci.yml のジョブ ID を `verify`、`name: verify`)。deploy.yml の test ジョブは名前を別にする(同名だと必須チェック名が曖昧になるおそれがあるため。deploy.yml の test は PR では走らないが、念のため)。
- deploy.yml の `needs`: `test` → `build` → `deploy` の 3 段にする。`build` ジョブの `needs: test` を足すのが最小変更。test 内のダミー build と、build ジョブの本物の `VITE_API_URL` を使う build は別物(後者の成果物だけを Pages に上げる)。

## 推奨アプローチ

(最終決定は設計フェーズ・人間に委ねる)

1. **ESLint は 10 系 + `@eslint/js` + `globals` を devDependencies に追加し、`eslint.config.js` を flat config で新設**(案A1)。対象は js/(browser)・tests/(browser + node + jest)・server/ と設定ファイル類(node)。`globalIgnores` で `dist/`・`coverage/`・`.claude/`・`.kiro/`(と念のため `server/node_modules/`)を除外。`package.json` に `lint: eslint .` を追加し、`verify.lint` に `npm run lint` を設定。ルールは recommended のまま始め、実測で件数が出たら「機械的に直す」を基本に、直しにくい少数のみ個別に調整する。
2. **検証手順の共有は案B3(composite action)を第一候補**、案B1(重複記述)を次点とする。理由は、必須チェック名がジョブ名そのままで固定でき、ブランチ保護の設定が単純になるため。モック混入チェックなど長い手順を 1 箇所に保てる。案B2(reusable workflow)は定義の一元化は同等だが、必須チェック名が連結形式になる点の確認コストと、`permissions`/`concurrency` の絡みで複雑になる。手順が今後ほぼ増えない前提なら案B1でも許容。
3. **main push の重複は案C1(許容)**。個人リポジトリで軽量な検証であり、deploy 前に必ず検証が走る性質(deploy.yml 内で完結)を優先する。ci.yml の push トリガーを残すと main の状態が常に可視化される。気になるなら案C2(ci.yml は PR のみ)をユーザーに提示。
4. **ブランチ保護は案D1(従来のブランチ保護、`gh api` PUT)**: `required_status_checks.strict=false`、`checks=[{context:"verify"}]`、`required_pull_request_reviews.required_approving_review_count=0`、`enforce_admins=false`(緊急時の `--admin` を残す)、`restrictions=null`。設定は PR マージ後、`verify` が main で一度走ってから。リポジトリ visibility が public であることを `gh repo view` で先に確認する。
5. 新規 ci.yml の action は現行メジャー(checkout@v7、setup-node@v7)で書く。deploy.yml 内の既存 action 更新(configure-pages@v6、upload-pages-artifact@v5、deploy-pages@v5 など)は、本トピックに含めるか分けるかを設計で決める(含めるなら deploy.yml の実デプロイで動作確認が必要)。

## 制約・リスク

- **ESLint の違反件数が未計測**。実測せずにスコープを確定しない。件数が多ければ「直す」が膨らむため、実測結果次第でルール緩和(例: `no-unused-vars` の `caughtErrors: 'none'`)も選択肢。
- deploy.yml を変更すると main へのマージが即デプロイ(`main` push)になる。ci.yml の追加だけならデプロイに影響しないが、deploy.yml の変更は **マージ後に実際のデプロイで検証される**。ユーザーが「ローカル確認 → マージ」で運用している(`stagingBranch` なし)ため、deploy.yml の構文ミスは本番デプロイ失敗に直結する。`workflow_dispatch` が既にあるので、マージ前の PR 上では deploy ジョブは走らず(push のみ)、**deploy.yml の変更はマージして初めて検証される**点をテスト計画に入れる。
- ブランチ保護を設定すると、以降 main への直接 push ができなくなる(`enforce_admins=false` でも管理者は push できてしまうが、方針は PR 経由)。loop-basic のリリース手順(`gh pr merge`)で CI 完了待ちが必要になる。プラグイン側の手順書の変更が必要かは別途確認(プラグインは upstream にコミットしない運用のため、プラグイン側を直さずこのリポジトリの文書側で扱う)。
- 必須チェック名を変えるとブランチ保護と食い違ってマージ不能になる(ジョブ名の固定がレビュー項目)。
- `grep` 系チェックの終了コードの向き(0 件で成功させる書き方)の誤りは、チェックが常に通る/常に落ちる不具合になる。ワークフロー確認時に「わざとモックを混入させたら落ちること」を一度確かめるのが望ましい(テスト計画向け)。
- ESLint 10 は Node 24 対応だが、`eslint@10` を使うにはローカル開発者の Node も `^20.19 || ^22.13 || >=24` が必要(`engines` は 24.x なので問題なし)。
- Windows(開発環境)で `npm ci` した `package-lock.json` と Linux の CI の差で lock が変わることは通常ないが、optional dependencies(vite の esbuild/rollup のプラットフォーム別バイナリ)で `npm ci` が失敗する既知の問題が過去にある。Windows で生成された lock では稀に起きる。CI 初回で確認(要確認)。
- [[python-is-store-stub]]: ワークフロー・設定ファイルの編集は Edit ツールで行い、編集後に `git status` で反映を確認する(この調査では適用対象の作業は無かった)。

## 未解決の疑問・要確認事項

1. ~~ESLint 10 + recommended での違反件数~~ → 解決済み(1 件。「追加の実測結果」)。
2. ~~リポジトリは public か~~ → 解決済み(PUBLIC)。
3. 検証手順の共有方式(案B1/B2/B3)の最終選択。必須チェック名の連結形式(reusable workflow の場合)は実際に PR で確認が必要。
4. main push の重複(案C1/C2)をユーザーが許容するか。
5. deploy.yml 内の既存 action(checkout@v4、setup-node@v4、configure-pages@v4、upload-pages-artifact@v3、deploy-pages@v4)を本トピックで上げるか。`check-latest: true` と `cache: 'npm'` を deploy.yml で維持するか(publish 系でのキャッシュ推奨設定との兼ね合い)。
6. `required_approving_review_count: 0` と `enforce_admins: false` の組み合わせで運用するか(一人運用前提)。loop-basic の release 手順に `gh pr checks --watch` / `--auto` を入れる必要があるか(プラグインを編集する運用上の位置づけ)。
7. ダミー `VITE_API_URL` の値(例 `https://example.invalid`)と、PR(フォーク含む)で secrets が使えない前提での build の分離。
8. `project-dev.md` の「Lint 未導入」記述と `loop.config.json` の `deployNote` の更新(設計の成果物に含める)。
9. Windows 生成 lock と Linux CI の optional dependency の相性(CI 初回で確認)。

## 参考資料

- ESLint 10 移行ガイド(Node 要件・recommended の追加ルール): https://eslint.org/docs/latest/use/migrate-to-10.0.0
- ESLint 設定ファイル(flat config、`globalIgnores`、`languageOptions.globals`): https://eslint.org/docs/latest/use/configure/configuration-files
- npm レジストリ(eslint 10.13.0、@eslint/js 10.0.1、globals 17.13.0): https://registry.npmjs.org/eslint/latest 、https://registry.npmjs.org/@eslint/js/latest 、https://registry.npmjs.org/globals/latest
- actions のリリース: https://github.com/actions/checkout/releases 、https://github.com/actions/setup-node/releases 、https://github.com/actions/configure-pages/releases 、https://github.com/actions/upload-pages-artifact/releases 、https://github.com/actions/deploy-pages/releases
- setup-node の高度な使い方(`node-version-file`、`cache-dependency-path`): https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
- ブランチ保護 REST API: https://docs.github.com/en/rest/branches/branch-protection#update-branch-protection
- 保護ブランチの概要(必須チェック、管理者、プラン別の可用性): https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- 再利用ワークフロー: https://docs.github.com/en/actions/using-workflows/reusing-workflows
- 既存の関連調査: `docs/investigations/2026-10-21-node24-upgrade.md`、`docs/process/project-dev.md`

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
