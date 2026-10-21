# テストレポート: GitHub Actions による CI 追加(ESLint 導入・deploy 前検証)

- 日付: 2026-10-22
- ステータス: レビュー待ち
- 対応する設計ドキュメント: docs/designs/2026-10-22-ci-actions.md
- PR: https://github.com/yt-glaceon/roulette/pull/6(ドラフト、テスト中)

## テスト対象

ci.yml(`verify` ジョブ)、composite action `.github/actions/verify`、deploy.yml の `pre-deploy-verify` 追加と action 更新、ESLint 10 導入と既存違反 1 件の修正、関連文書・設定の更新。実装タスク A〜D の統合後、設計のタスク E のうち E1〜E3 を実施した。E4(マージと main 上のデプロイ確認)・E5(ブランチ保護設定)はマージ後の作業のため**未実施**。

テスト開始時の HEAD は `e860aaa`(feature/ci-actions)。

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト(E1) | `npm test`: 12 suites / 145 tests 全通過(終了コード 0)。ローカルとCI(Linux)で同件数 | pass |
| Lint(E1) | `npm run lint`(`eslint . --max-warnings 0`)終了コード 0、違反・警告 0 | pass |
| 構文チェック(E1) | `node --check server/index.js` 終了コード 0 | pass |
| ビルド(E1) | `VITE_API_URL=https://example.invalid npm run build` 終了コード 0 | pass |
| 手動確認(E1 モック混入) | dist に対し action と同じ判定を実施(下記の注記参照) | pass |
| 静的検査 | actionlint 1.7.12 で ci.yml・deploy.yml: 終了コード 0、指摘 0 | pass |
| PR 上の正常系(E2) | PR #6 で `verify` が緑(32 秒)。Linux の `npm ci` 成功 | pass |
| 負のテスト 1(E3) | モック混入で verify が赤(モック混入チェックのステップで失敗) | pass(期待どおり落ちた) |
| 負のテスト 2(E3) | lint 違反で verify が赤(Lint ステップで失敗、以降のテスト・ビルドは未実行) | pass(期待どおり落ちた) |
| 復旧(E3) | 負のテスト用コミットを履歴から消し、verify が再び緑 | pass |

## 証跡(手動確認分)

### E1: ローカル(worktree ルート、composite action と同順)

| 手順 | 結果 |
| --- | --- |
| `npm ci` | 終了コード 0 |
| `npm ci --prefix server` | 96 packages added、脆弱性 0、終了コード 0 |
| `npm run lint` | 終了コード 0 |
| `node --check server/index.js` | 終了コード 0 |
| `npm test` | Test Suites: 12 passed / Tests: 145 passed、終了コード 0 |
| `VITE_API_URL=https://example.invalid npm run build` | 終了コード 0(`dist/assets/index-*.js` 35.02 kB) |
| モック混入チェック | `dist/index.html` 存在(0)、`grep -rlE --include='*.js' --include='*.html' '【モック】\|mock-badge' dist` が終了コード 1(0 件)、`dist/assets` 存在、`find dist/assets -iname '*mock*'` が 0 件 |

注記: この環境ではシェルスクリプトファイルの実行が制限されていたため、action.yml のスクリプトを `bash -e` で丸ごと実行する代わりに、同スクリプト内の各判定コマンドを同じ引数で個別に実行して終了コードを確認した(判定ロジックの実機検証は PR 上の CI が action.yml そのものを実行した E2・E3 で担保)。

### 静的検査

actionlint 1.7.12(スクラッチ領域)で `.github/workflows/ci.yml` と `.github/workflows/deploy.yml` を検査し、終了コード 0。

### E2: PR 上の CI

- ドラフト PR: https://github.com/yt-glaceon/roulette/pull/6(base: main)
- Run 39626717378: ジョブ名 `verify`、全ステップ成功、**所要 32 秒**(`gh pr checks` 表示)。
- Linux の `npm ci`: ルート `added 404 packages, and audited 405 packages in 6s`、server `added 96 packages, and audited 97 packages in 1s` で成功(optional 依存の問題なし)。
- CI 上の `npm test`: `Test Suites: 12 passed, 12 total` / `Tests: 145 passed, 145 total`。ビルド成功、`モック混入なし` を出力。
- 注意: `gh pr checks --watch` は PR 作成直後に「no checks reported」で即終了した(チェックの登録遅延)。以降は `gh run watch` で完了まで確認した。
- 注釈: 「ubuntu-latest が 2026-10-19 から Ubuntu 26 へ移行する」という GitHub の通知が出た(動作には影響なし。将来 Ubuntu 26 でも緑かは別途の観察事項)。

### E3: 負のテスト(PR 上、別コミット)

どちらも検証後に `git reset --hard e860aaa` と `git push --force-with-lease origin feature/ci-actions` で履歴から消した(main には触れていない)。

1. モック混入(コミット 68cfaeb、`js/app-controller.js` の `init` に `console.log('【モック】');` と `console.log('mock-badge');` を別リテラルで追加)
   - Run 39626909415: `verify` が失敗。ログに `##[error]dist にモック表示が混入しています` と `dist/assets/index-Z8nxkKWt.js` が出力され、モック混入チェックのステップで失敗。
   - 検出の内訳: ローカルビルドで `dist/assets/*.js` に **`【モック】` はそのままの表記(\uXXXX 化されず)で残っており、`grep` で 1 件ヒット**。`mock-badge` も 1 件ヒット。つまり両パターンとも検出可能で、設計が懸念した minify によるエスケープは今回の vite ビルドでは発生しなかった。ただし CI 上の失敗は 2 パターンが同じファイルに含まれるため、どちらで検知されたかをログだけで区別はできない(`-l` はファイル名のみ出力)。ローカルでは両方個別にヒットしている。
2. lint 違反(コミット e3cf840、`js/config.js` に未使用変数 `const unusedNegativeTest = 1;` を追加。モックのコミットは先に履歴から消して単独で検証)
   - Run 39627075639: `verify` が失敗。`##[error]  18:7  error  'unusedNegativeTest' is assigned a value but never used  no-unused-vars` と `✖ 1 problem (1 error, 0 warnings)`、続けて Lint ステップが `exit code 1` で終了。ログに `npm test`・build のステップは出ておらず、Lint で止まった。
3. 復旧: 負のテスト用コミットを消して `e860aaa` に戻した後、Run 39627159787 で `verify` が緑(28 秒)。

## 不合格・不具合の詳細

なし。

## 未検証の観点・既知の制限事項

- **E4・E5 は未実施**(マージ後の作業)。
- **deploy.yml は未検証**: actionlint(静的検査)は通ったが、`pre-deploy-verify` → `build` → `deploy` の実行、および更新した action(upload-pages-artifact v5、deploy-pages v5、configure-pages v6 ほか)の実動作は、マージ後の本番デプロイで初めて検証される。feature ブランチからの `workflow_dispatch` は本番公開の恐れがあるため実施していない(設計どおり)。`needs` による「検証失敗時に deploy しない」挙動も実機では確認していない。
- **ブランチ保護**は未設定のため、必須チェック名 `verify` が保護側で解決されることは未確認。
- composite action のモック混入スクリプトを、偽 dist の 5 ケース(設計 B4)で今回再実行はしていない(実装フェーズで実施済みとされるもの。今回は実 dist の正常系と、CI 上の実混入1ケースのみ)。
- 負のテストで `【モック】` 単独・`mock-badge` 単独での CI 検出は個別には切り分けていない(上記)。ローカルでは両者とも grep にヒットすることを確認した。
- `*.map`(ソースマップ)は検査対象外(設計どおり)。
- ubuntu-latest の Ubuntu 26 移行は未観察。

## コードレビューからの引き継ぎ

コードレビューは PASS(ラウンド 1)。未解決の MAJOR はなし。MINOR 2 件(deploy.yml の build・deploy に timeout-minutes が無い〈既存どおり・対応任意〉、memory エントリ 3 件の related_topics 追記が対象ファイル一覧外〈妥当・対応不要〉)。

## 総合判定

合格(E1〜E3 の範囲。E4・E5 とデプロイ関連の観点はマージ後に確認が必要)

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
|  | 承認してクローズ / 修正依頼 / 設計からやり直し |  |
