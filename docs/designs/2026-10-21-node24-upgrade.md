# 設計: Node.js 24 への移行(node24-upgrade)

- 日付: 2026-10-21
- ステータス: レビュー待ち
- 対応する調査ドキュメント: docs/investigations/2026-10-21-node24-upgrade.md
- 承認者: (承認ゲート通過時に記入)
- 承認日: (承認ゲート通過時に記入)

## 目的・スコープ

2026-10-21 の Node.js セキュリティリリース(修正版 v24.22.1 など)に対応するため、server(Render)と CI(GitHub Actions)の Node を 24 系に揃え、修正版を確実に使える状態にする。EOL の Node 20 / 18 を前提にした記述も更新する。

### やること

- `server/package.json` に `"engines": { "node": "24.x" }` を追加する。
- `.github/workflows/deploy.yml` の `node-version` を `'24'` にし、`check-latest: true` を追加する(修正版 24.22.1 以降を確実に取るため)。
- ルートの `package.json` にも `"engines": { "node": "24.x" }` を追加する(Render がルートの package.json を読む可能性を考え、食い違いを防ぐ安全側)。
- `README.md`(v18 以上)と `SETUP.md`(v20 以上)の Node バージョン記述を「v24」に更新する。
- `server/README.md` の Render 手順に、Node バージョンは engines で指定していること、デプロイログで確認すること、効かない場合は Render の環境変数 `NODE_VERSION=24` を設定することを短く追記する。
- server の `npm audit fix`(package.json の範囲内で lockfile のみ更新。`--force` は使わない)を含める(壁打ちでユーザーが決定)。Node 移行とは別コミットにする。

### やらないこと(スコープ外)

- `.nvmrc` / `.node-version` の追加。理由: Render は Root Directory が `server` のとき、どこの `.node-version` / `.nvmrc` を読むかが公式に未記載で、置いても効くか分からない。効かない・食い違うと混乱の元になる。ダッシュボードで挙動を確認できてから別途検討する。
- `actions/setup-node@v4` など GitHub Actions のアクション自体のバージョン更新(別トピック)。
- `npm audit fix --force` と、Express 5 / discord.js メジャー更新などの破壊的な依存更新。
- ルート(フロント)側の `npm audit` 対応(ビルド時のみ Node を使い本番は静的配信のため優先度が低い)。
- `.kiro/specs/` 配下の過去メモの更新(履歴資料)。
- Render ダッシュボードの設定変更そのもの(実装ではなく、デプロイ後確認で人間が見る。効かない場合のみ退避策として設定)。
- discord.js / undici 経由の Brotli 展開経路の調査(調査ドキュメントの未解決事項 6。ランタイム更新自体で緩和されるため、今回は追わない)。

## アーキテクチャ・変更概要

DB変更・フロントエンドの構成変更はないため、`db-designer` / `frontend-designer` への委譲は行わない。設定とドキュメントのみの変更で、アプリのコードは変えない。

| ファイル | 変更内容 |
| --- | --- |
| `server/package.json` | `engines` を追加: `"engines": { "node": "24.x" }`(`description` などと同じ階層、`dependencies` の前後どちらでもよい) |
| `server/package-lock.json` | ルートパッケージ(`packages[""]`)の `engines` 追記が反映される。`npm install --package-lock-only` で同期する。ステップ5の `npm audit fix` による依存の更新も(別コミットで)ここに入る |
| `package.json`(ルート) | `engines` を追加: `"engines": { "node": "24.x" }` |
| `package-lock.json`(ルート) | 同上。`packages[""]` の `engines` の追記のみになること |
| `.github/workflows/deploy.yml` | `node-version: '20'` を `'24'` に変更し、`with:` に `check-latest: true` を追加(`cache: 'npm'` は維持) |
| `README.md` | 61 行付近「Node.js(v18 以上)」を「Node.js v24」に更新(文言は実装時に周辺に合わせる) |
| `SETUP.md` | 16 行付近「Node.js v20 以上」を「Node.js v24」に更新 |
| `server/README.md` | Render 手順(162〜176 行付近)に Node バージョンの注記を追記(下記) |

`README.md` の Render 手順(112〜126 行付近)には、「Node バージョンの指定と確認は `server/README.md` を参照」という 1 行だけを足す(内容の重複は避ける)。

`server/README.md` に追記する内容(短く、3 点):

1. Node バージョンは `server/package.json` の `engines`(24.x)で指定している。
2. 設定後は、デプロイログの冒頭に出る Node のバージョンが 24.22.1 以降であることを確認する。
3. 24 系にならない場合は Render の Environment に `NODE_VERSION=24` を設定する(`NODE_VERSION` は engines より優先される)。24 系だがパッチが古い場合は `NODE_VERSION=24.22.1` のように完全指定する。

注意として、Render では `NODE_VERSION` が設定済みだと engines は無視される(優先順位は `render-node-version` エントリのとおり)。

### 判断の根拠

- engines を `24.x` にする(上限付き)のは Render 公式の「範囲指定には上限を付けよ」に沿うため。`>=24` は将来のメジャー更新で意図せず上がる。
- ルート engines を付けるのは、Render がルートの package.json を読んでも server と同じ 24.x に解決され、食い違わないようにするため。ローカル開発・CI で Node 24 が前提と明示される利点もある。ルート依存(jest、vite 5)の engines は 24 を除外しない(調査済み)。
- `check-latest: true` は、tool cache にある古いパッチ(24.22.1 未満)が使われる可能性を下げるため。セットアップが数秒遅くなる程度。
- `npm audit fix` を含める: 調査上、9 件(critical 1、high 4)がすべて package.json の範囲内で解消可能。Node 更新と同じタイミングで直すと検証が 1 回で済む一方、依頼の範囲を超え、Express / discord.js の依存が変わる。ユーザーの判断で含めることにした。Node 移行の変更とは別コミットにして切り戻しやすくする。

## 実装ステップ

並列にできる単位(ファイルが重ならない)に分ける。ステップ1〜4は互いに独立で並列実行可。ステップ5はステップ1の完了・コミット後に実行する(同じファイルを触るため)。ステップ6以降は全ステップ完了後。

- [ ] ステップ1(担当A: server 系): `server/package.json` に `engines.node = "24.x"` を追加し、`server/` で `npm install --package-lock-only` を実行して `server/package-lock.json` を同期する。`git diff` で lockfile の差分が `packages[""]` の `engines` 追記のみであることを確認する(大きな差分が出たら中止して報告)。触るファイル: `server/package.json`, `server/package-lock.json`。
- [ ] ステップ2(担当B: ルート系): ルート `package.json` に `engines.node = "24.x"` を追加し、ルートで `npm install --package-lock-only` を実行して `package-lock.json` を同期する。差分が `packages[""]` の `engines` 追記のみであることを確認する。触るファイル: `package.json`, `package-lock.json`。
- [ ] ステップ3(担当C: CI): `.github/workflows/deploy.yml` の `node-version` を `'24'` に変更し、`check-latest: true` を追加する。他の行(アクションのバージョンなど)は変更しない。触るファイル: `.github/workflows/deploy.yml` のみ。
- [ ] ステップ4(担当D: ドキュメント): `README.md` / `SETUP.md` の Node バージョン記述を「v24」に更新し、`server/README.md` の Render 手順に上記3点の注記を追記する。`.kiro/specs/` は更新しない。触るファイル: `README.md`, `SETUP.md`, `server/README.md` のみ。
- [ ] ステップ5(ステップ1のコミット後): `server/` で `npm audit fix`(`--force` なし)を実行する。変更が `server/package-lock.json` のみで、`server/package.json` に差分が出ないことを確認する。実行後 `npm audit` を取り、残る指摘を記録する。Node 移行の変更とは別コミットにする。触るファイル: `server/package-lock.json` のみ。
- [ ] ステップ6(全ステップ完了後): ルートで `npm ci` → `npm test` → `npm run build` を実行し、それぞれ `node -v` を記録する(テスト戦略の合格基準を参照)。
- [ ] ステップ7(全ステップ完了後): server のトークン無し起動(テスト戦略の手順。`server/` を cwd にしない)。実 `.env` を使う実起動確認は人間が実施する。
- [ ] ステップ8: 実装結果と確認結果を設計書末尾の記録欄・テストレポートに引き継ぐ。デプロイ後の確認項目(テスト戦略)を人間への依頼事項として一覧にする。

## テスト戦略

設定とドキュメントのみの変更で、アプリのロジックは変わらない。自動テストでは「Node 24 でも既存機能が壊れていない」ことと、「設定ファイルが意図どおり」であることを確認し、本質的な検証(Render と CI が実際に修正版を使うか)はデプロイ後の人間の確認に頼る。

### 実装時に実行する検証(implementer / tester)

- 構文・内容の確認: `server/package.json`、ルート `package.json` が JSON として正しく、`engines.node` が `24.x` であること。確認コマンドは `node -p "JSON.parse(require('fs').readFileSync('server/package.json','utf8')).engines"`(ルートも同様)。`deploy.yml` の `node-version: '24'` と `check-latest: true` が `with:` 配下にインデントされていること。
- lockfile の差分: ステップ1・2のコミットでは lockfile 差分が `engines` の追記のみ。依存の更新はステップ5のコミットにだけ入る。
- ルート `npm test`: 全スイート(調査時点で 12 スイート / 145 テスト)が PASS。調査時の実行は Node v24.13.1。実行時の `node -v` を記録する。ExperimentalWarning は既知で、失敗ではない。
- ルート `npm run build`: 成功し `dist/` が生成されること。
- ルートで `npm ci` が Node 24 で通ること(engines 追加で警告・失敗しないこと)。
- server のトークン無し起動(implementer / tester が実施。import の確認):
  - **ワークツリーには `server/.env`(実トークン)がコピーされている。`server/index.js` は `dotenv.config()` で cwd の `.env` を読むので、`server/` を cwd にして起動してはならない**(本番 Bot と同じトークンで二重ログインしてしまう)。
  - 手順: `.env` の無いスクラッチディレクトリを cwd にし、`DISCORD_BOT_TOKEN` を空にして `node <ワークツリー>/server/index.js` を実行する(Bash ツール(Git Bash)で実行する。例: `cd <scratch> && DISCORD_BOT_TOKEN= node <worktree>/server/index.js`。dotenv は既存の環境変数を上書きしない。PowerShell の `$env:X=''` は変数を消すだけなので使わない)。起動前に `.env` が cwd に無いことを確かめる。
  - 期待: discord.js が `TokenInvalid`(または同等のトークン不正エラー)で reject し、未処理 rejection でプロセスが終了する。`login()` が `app.listen()` より先に呼ばれるため、「Server running」のログは出る場合も出ない場合もある。どちらでも失敗ではない。**トークン不正のエラーで終了し、モジュール解決エラー(`ERR_MODULE_NOT_FOUND` など)が出ていなければ合格**(Node 24 で express / discord.js を読み込めた確認)。実際の出力を記録する。
  - `node --check` は構文確認でしかなく、この代わりにはならない。
- server の実起動確認(人間がローカルで、マージ前に実施):
  - 本番 Bot との二重起動を避けるため、**確認中は Render のサービスを Suspend し、確認後に Resume する**(人間が行う。Free プランなので数分の停止は許容)。Suspend できない場合は、二重起動を許容し、下記の合格基準をローカル API の直接確認に限る。
  - 手順: ワークツリーの `server/` で Node 24 を使い `npm start`。「Bot logged in as ...」「スラッシュコマンドの登録完了」「Server running on port ...」のログ、`curl http://localhost:<ポート>/` が `status: ok` を返すこと(ポートは「Server running on port ...」のログに出た値。以下の API も同じ)。
  - Discord で `/roulette` を実行し、**ローカルのログ**に `[Roulette] トークン生成:` が出ること。そのトークンで `curl` により `http://localhost:3000/api/validate-token?token=...`、`/api/guild`、`/api/guild/channels`、`/api/guild/channels/<channelId>/members` が正しく応答すること(ステップ5で Express の path-to-regexp、qs、body-parser が更新されるため、ルートパラメータとクエリ解析の確認が目的)。合格基準はローカル API の応答で判断し、Discord 上の URL がどのインスタンスから出たかには依存しない。トークンの値は記録やドキュメントに書かない。
- ステップ5の追加検証: 修正後の `npm audit` の結果を記録する(critical / high が 0 件になる、または残る指摘とその理由)。

### デプロイ後の確認(人間が行う)

1. GitHub Actions のログ: `Setup Node.js` ステップで使われた Node が 24.22.1 以降であること。24 系だが 24.22.1 未満の場合(配布元にまだ修正版が無い等)は、追跡事項としてテストレポートに残す。
2. Render でデプロイされたコミットが今回のマージコミットであることを確認する。自動デプロイが走っていない場合(現状その可能性が高い)は、ダッシュボードから Manual Deploy する。**古いデプロイのログで判断しない。**
3. Render のデプロイログの `==> Using Node.js version ...` の行を全文そのまま記録し、次のように分岐する。
   - 24 系でない(例: `22.22.0 (default)`) → engines が読まれていない → Environment に `NODE_VERSION=24` を設定して再デプロイ。
   - 24 系だが 24.22.1 未満 → engines は効いているが Render に修正版がまだ無い可能性 → `NODE_VERSION=24.22.1` の完全指定を試す。それでも駄目なら時間をおいて再デプロイし、結果を記録する。
   - 24.22.1 以降 → 完了。
4. Render ダッシュボード: Environment の `NODE_VERSION` の有無(2026-10-21 時点で未設定)。
5. デプロイ後に Bot が再接続しログインすること、`GET /` が `status: ok` を返すこと(無料プランのコールドスタートを考慮して待つ)。
6. 実測結果(読まれたのが engines か、`(default)` 表記など)を調査ドキュメントの未解決事項 2・3 と `render-node-version` エントリに追記する。

**完了条件の扱い:** Render 側に 24.22.1 がまだ無いために 24 系の古いパッチで動く場合、このトピックは「24 系への移行と engines の反映は完了、修正版の適用は追跡事項」として閉じる。追跡事項はテストレポートに残す。

**自動テストを新規作成するか:** しない(理由: 設定ファイルとドキュメントのみの変更で、テスト可能なロジックの追加・変更がない。設定値の検証は package.json / deploy.yml の内容確認と、既存の 145 テスト・ビルドが Node 24 で通ることで足りる。server にはテスト基盤がなく、本変更のために新設する価値が小さい。本質的な検証は Render / GitHub Actions の実環境でのバージョン確認であり、自動テストでは再現できない)

## リスク・トレードオフ

- Render で engines が読まれない、または `NODE_VERSION` が既に設定されていると、Node が更新されないままになる。対策: デプロイ後確認を必須にし、退避策(`NODE_VERSION=24`)を `server/README.md` にも書く。
- Render が Root Directory `server` のとき、ルートの `package.json` を読む可能性が排除できない。ルートにも同じ `24.x` を入れることで、どちらを読んでも同じ結果になる。ただし管理箇所が2か所に増え、将来バージョンを上げるときに片方を忘れる恐れがある(`README.md` ではなく `server/README.md` に「両方を更新する」旨を1行書くかは implementer の裁量)。
- `24.x` が修正版(24.22.1 以降)に解決される保証が文書上はない。対策は上記のデプロイ後確認。解決されないとき、`NODE_VERSION=24.22.1` などの完全指定が最終手段。
- ルート engines の追加で、`engine-strict` を有効にした環境や Node 24 以外のローカル環境では警告・拒否が出る。既存の jest / vite 5 の engines と矛盾しないことは調査済みで、今回の意図(24 を標準とする)に沿う。
- `check-latest: true` によるセットアップ時間の微増と、初回の npm キャッシュミス。実害は小さい。
- GitHub Actions の他アクション(`actions/*@v4` など)は node20 ランタイムのまま。今回は更新しないため、GitHub 側の廃止方針による警告や将来の動作変更が残る(別トピック候補)。
- `npm audit fix`(ステップ5)のリスク:
  - 変更は `server/package-lock.json` のみに限定されるが、Express(path-to-regexp、qs、body-parser、proxy-addr)と discord.js(undici)のパッチ・マイナー更新が入り、挙動が変わりうる。自動テストが server に無いため、実 `.env` での手動確認が必須。
  - Node 移行と同時に原因切り分けが難しくなるため、別コミットにして問題時に切り戻せるようにする。
- 実際の起動確認は実 `.env` が必要で、人間の作業に依存する。トークン無しの起動では未処理 rejection で落ちる見込みなので、「落ちた = 失敗」と誤解しないよう記録に書く(この挙動は既存で、今回の変更では直さない)。

## ロールバック方針

- コードやデータの変更はなく、設定の巻き戻しのみで済む。`git revert` で該当コミット(Node 移行、audit fix は別コミット)を戻し、再デプロイする。
- Render 側: engines を戻しても、Render に `NODE_VERSION` を設定した場合はその環境変数を削除(または以前の値に戻す)。サービスは再デプロイで切り替わるため、問題が出たら前回の正常デプロイにダッシュボードから戻すこともできる。
- GitHub Pages 側: deploy.yml を戻して再実行すれば Node 20 に戻る(EOL のため一時的な退避としてのみ使う)。
- audit fix のみ問題が出た場合は、audit fix のコミットだけを revert し、Node 移行は維持する。

## 壁打ち(grilling)の記録

2026-10-21、ユーザーと確認した結果。

1. `npm audit fix`(server、lockfile のみ): **含める**。Node 移行とは別コミット(ステップ5)。
2. ルート `package.json` の engines: **付ける**(ステップ2)。
3. README / SETUP の表記: engines が `24.x` なので「v24」とする(オーケストレーター判断)。
4. Render の現状(2026-10-21 にダッシュボードで確認):
   - 最新デプロイ(132dc98、手動デプロイ)のログ: `Using Node.js version 22.22.0 (default)`。指定なしの既定版で、今回の修正版(22.23.4)より古い。
   - 環境変数は `BACKEND_URL`・`DISCORD_BOT…`・`FRONTEND_URL` の 3 つで、`NODE_VERSION` は未設定。よって engines が効く前提で進めてよい。
   - Root Directory は `server`、Build Command は `npm install`、Start は `npm start`。
   - デプロイ一覧で最新のデプロイは「Manual」トリガーだった。Render の自動デプロイが走らない件は、ユーザーの依頼でこのサイクルの完了後に別途調査する(本トピックの範囲外)。マージ後の Render 反映は手動デプロイが必要になる可能性がある。
5. 実 `.env` での server 起動確認: **ローカルでマージ前に**人間が行う(ワークツリーで Node 24 を使い `npm start`)。デプロイ後の Render 側の確認(テスト戦略「デプロイ後の確認」)も別途行う。

## 設計レビュー結果

`design-reviewer` による自動レビュー(最大2ラウンド、`/design` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | MAJOR | MAJOR1: ワークツリーに実 `server/.env` があり、`server/` で起動すると本番 Bot と二重ログインする/人間の確認がどのインスタンスの応答か曖昧。MAJOR2: 自動デプロイ未実行の前提がなく古いログで誤判断しうる/24 系の古いパッチと engines 不読込を区別できない。MINOR 5件(起動の見込み、確認コマンド、`npm ci`、条件付き表現、README の扱い) |
| 2 | PASS | ラウンド1の指摘はすべて解消。MINOR 3件(ポート決め打ち、Actions 側の 24.22.1 未満時の扱い、PowerShell での空変数)も反映済み |

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
| 2026-10-21 | 承認 | 設計レビュー2ラウンド(最終 PASS)後に承認 |

## 共有メモリ

- 適用した pitfall: [[render-node-version]](Node 指定を変えたらデプロイログで実際の版を確認する、を検証手順に反映)。`related_topics` は既に `node24-upgrade` を含み、新規追記は不要。
- 新規の decision / convention / open-question の追加はなし。
- スキル化候補: なし(該当エントリの related_topics は 1 件)。
