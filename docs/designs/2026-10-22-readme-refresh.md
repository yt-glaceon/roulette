# 設計: README・SETUP.md・server/README.md を現状の実装に合わせて更新する(readme-refresh)

- 日付: 2026-10-22
- ステータス: レビュー待ち
- 対応する調査ドキュメント: [docs/investigations/2026-10-22-readme-refresh.md](../investigations/2026-10-22-readme-refresh.md)
- 承認者: (承認ゲート通過時に記入)
- 承認日: (承認ゲート通過時に記入)

## 目的・スコープ

ルートの `README.md` のうち、実装・運用と食い違っている 3 点を直す。壁打ちで、同じずれがある `server/README.md` と `SETUP.md` も今回直すことになった(調査の案C)。各ファイルの既存の節立てと文体(です・ます調、見出しの番号付け、特徴一覧の絵文字)は保つ。

### やること

1. 「API エンドポイント」節: トークンをクエリ `?token=xxx` で渡す記述をやめ、`x-access-token` リクエストヘッダで送ることを書く。
2. 「プロジェクト構造」節: 構造図を実際のファイル配置に合わせる。
3. 開発・CI・デプロイの説明を現状に合わせる(フロントの開発サーバーの URL、モック、テスト・lint・ビルドのコマンド、PR と CI を経由したデプロイの流れ)。
4. `server/README.md` の API 説明とデプロイ説明を同じ内容に合わせる(下記 D)。
5. `SETUP.md` の開発サーバーの URL とデプロイ説明を同じ内容に合わせる(下記 E)。

### やらないこと(スコープ外)

- README の全面的な書き直し・節の並べ替え(調査の案B)。
- コード・設定ファイルの変更。
- 上の 3 ファイル以外の文書(`docs/`・`.kiro/specs/` など)。
- 3 ファイルのうち、今回のずれと関係のない記述の書き直し(例: SETUP.md のトラブルシューティングの既存項目、`your-username` などのプレースホルダー)。
- `server/.env.example` ファイルの新規作成(手順の文言だけを直す。下記 C-5)。
- 設計レビューで見つかった次の 2 つのずれ(フォローアップとして PR 本文に書く):
  - `FRONTEND_URL` は「CORS 用」と書かれているが、実装の CORS はハードコードされた `allowedOrigins`(`server/index.js:125-129`)で判定しており、`FRONTEND_URL` は Bot が返す URL の組み立てにだけ使われる。
  - README の「特徴」「使い方」がルーレット演出だけを前提にしている(実際はスロット・ドラムロール・カードめくりも選べる)。

## アーキテクチャ・変更概要

変更するファイルは `README.md`・`server/README.md`・`SETUP.md` の 3 つ。A〜C は `README.md`、D は `server/README.md`、E は `SETUP.md` の変更。3 ファイルで同じことを書く箇所は、下の「共通文案」をそのまま使う(各ファイルの見出しレベルや前後の文に合わせた最小限の調整は可)。

### 共通文案

**文案T(トークンの渡し方)** — A・D-1 で使う:

> `/api/` で始まるエンドポイントには、Discord の `/roulette` コマンドで発行されたアクセストークンを `x-access-token` リクエストヘッダで送ります。トークンが無い・無効・期限切れの場合は `401` を返します。Bot が返す URL の `?token=` はフロントエンドが読み取り、API にはヘッダで送ります(URL のクエリでは API に渡しません)。

**文案P(変更とデプロイの流れ)** — C-2・C-3・E-2 で使う:

> `main` はブランチ保護により PR 必須で、CI の `verify` が通るまでマージできません(直接プッシュはできません)。
>
> 1. `main` から作業ブランチを切って変更する
> 2. PR を作ると CI(`.github/workflows/ci.yml` の `verify`)が走る
> 3. `verify` が通ったら PR をマージする
> 4. `main` へのマージで `deploy.yml` が走り、デプロイ前検証(`pre-deploy-verify`、CI と同じ検証)に通った場合だけ GitHub Pages にデプロイされる

**文案R(Render の自動デプロイ)** — C-3・D-3 で使う:

> 初回作成後は、`server/` を変更したコミットが `main` にマージされると Render に自動デプロイされます(Webhook が遅れて数分〜数十分かかることがあります)。`server/` の外だけの変更ではデプロイされません。

**文案M(モック)** — C-1・E-1 で使う:

> Discord なしで画面を確認するには `http://localhost:5500/roulette/?mock`(プリセットのチャネル)、または `?mock=12`(12 人のチャネルを先頭に追加。1〜100)を開きます。開発サーバー専用で、本番ビルドでは無効です。

地の文・コード例のどちらにも `git push origin main` という文字列は書かない(機械チェックの対象)。

### A. 「API エンドポイント」節

- 見出しの 4 つのエンドポイントから `?token=xxx` を外す(例: `GET /api/guild`)。説明文はそのまま。
- 節の冒頭に、トークンの渡し方を短く書く:
  - すべてのエンドポイントで、`/roulette` コマンドで発行されたアクセストークンを `x-access-token` リクエストヘッダで送る。
  - トークンが無い・無効・期限切れのときは `401` を返す。
  - Bot が返す URL の `?token=` はフロントエンドが読み取り、API にはヘッダで送る(URL のクエリでは API に渡さない)。
- 「セキュリティ」節に 1 行足す: アクセストークンは URL ではなくヘッダで API に送り、サーバーのログには全文を出さない(`server/log-safe.js`)。

### B. 「プロジェクト構造」節

構造図を次の内容にする(コメントは日本語で 1 行ずつ。`node_modules/`・`dist/`・`.env` は載せない)。

```
.
├── index.html               # メインHTML
├── css/
│   └── style.css            # スタイルシート
├── js/
│   ├── app-controller.js    # アプリケーションコントローラー
│   ├── api-request.js       # API リクエストの組み立て(x-access-token ヘッダ)
│   ├── config.js            # 設定ファイル
│   ├── discord-client.js    # Discord APIクライアント
│   ├── roulette-engine.js   # ルーレットロジック
│   ├── ui-controller.js     # UI制御
│   ├── result-manager.js    # 結果管理
│   ├── animations/          # 演出(ルーレット・スロット・ドラムロール・カードめくり、時間配分の計算)
│   └── dev/                 # 開発サーバー専用のモック(本番ビルドには含まれない)
├── tests/
│   └── unit/                # Jest のユニットテスト
├── server/                  # バックエンドサーバー
│   ├── index.js             # サーバーエントリーポイント
│   ├── log-safe.js          # ログ用の伏せ字・エラー要約
│   ├── package.json         # 依存関係
│   └── README.md            # サーバードキュメント
├── .github/
│   ├── workflows/           # CI(ci.yml)と GitHub Pages へのデプロイ(deploy.yml)
│   └── actions/verify/      # CI とデプロイ前検証で共通の検証手順
├── docs/                    # 開発サイクルの調査・設計・テストの記録
├── package.json             # フロントエンドの依存関係と npm スクリプト
├── eslint.config.js         # ESLint の設定
├── jest.config.js           # Jest の設定
├── vite.config.js           # Vite の設定
├── SETUP.md                 # 詳しいセットアップガイド
└── README.md                # このファイル
```

`js/animations/` の中のファイル名までは列挙しない(演出を足すたびに README がずれるのを避ける)。

### C. 開発・CI・デプロイの説明

1. 「4. フロントエンドのセットアップ(ローカル)」
   - アクセス先を `http://localhost:5500/roulette/` に直す(`vite.config.js` の `base: '/roulette/'`)。直すのはブラウザで開く URL だけ。`FRONTEND_URL` の値や CORS のオリジンとして書かれた `http://localhost:5500` は変えない(C-1・E-1 共通)。
   - 文案M を足す。
2. 新しい節「## 開発」を「セットアップ」節の後、「技術スタック」節の前に追加する。
   - ルートで実行するコマンドの表または箇条書き: `npm test`(Jest。ES Modules のため `--experimental-vm-modules` 付きで実行される)、`npm run test:watch`、`npm run test:coverage`、`npm run lint`(ESLint、警告 0 件が必要)、`npm run build`(`dist/` に出力)、`npm run preview`。
   - `server/` にはテストがないことを 1 行で書く。
   - 変更の流れ: 文案P を載せる。
   - CI の中身を 1 行で書く: lint → `node --check server/index.js` → テスト → ビルド → 本番ビルドにモックが混入していないかの確認(`.github/actions/verify`)。
3. 「6.3 デプロイ」
   - `git add` / `git commit` / push のコード例を消し、「変更の流れは「開発」節を参照。PR を `main` にマージすると `deploy.yml` が走り、デプロイ前検証に通った場合だけ GitHub Pages にデプロイされます。」に置き換える。進行状況は Actions タブで確認できる、という既存の文は残す。
   - 「5. Render へのデプロイ」の手順 6(「Create Web Service」)の後、「Node バージョンの指定と確認は `server/README.md` を参照。」の前に、文案R を足す。
5. 「3. バックエンドのセットアップ(ローカル)」: `server/` に `.env.example` は無いので、`cp .env.example .env` の行を消し、「`server/.env` を作成して次の変数を設定」とし、`DISCORD_BOT_TOKEN`・`PORT`(省略時 3000)・`FRONTEND_URL`(開発時は `http://localhost:5500`)を書く。ルートの `.env.example` はあるので「4. フロントエンドのセットアップ」の `cp .env.example .env` はそのまま。
4. 「技術スタック」節に「### 開発ツール」を足す: Vite、Jest(jsdom)+ fast-check、ESLint、GitHub Actions。

### D. `server/README.md`

1. 「API エンドポイント」節
   - `/api/` で始まる 4 つの見出しから `?token=xxx` を外す(`GET /` のヘルスチェックはトークン不要のまま)。
   - 節の冒頭に文案T を書く。`GET /` はトークン不要と添える。
   - 401 のときの応答例を 1 つ載せる: `{ "error": "無効なトークンです" }`(メッセージは「アクセストークンが必要です」「無効なトークンです」「トークンの有効期限が切れています」の 3 種類。`server/index.js` の `validateToken`)。
   - `GET /api/guild/channels` のレスポンス例に `"memberCount": 3` を足す(実装は `memberCount: channel.members.size` も返す。`server/index.js:221-226`)。ほかのレスポンス例はそのまま。
2. 「Discord Bot」節: 生成される URL の `?token=` はそのまま。その下に「フロントエンドがこのトークンを読み取り、API には `x-access-token` ヘッダで送る」と 1 行足す。
3. 「デプロイ」→「Render へのデプロイ」節の手順 6 の後(「#### Node バージョンの指定と確認」の前)に、文案R を足す。
4. 「機能」節の「トークンベースのアクセス制御」の後に「ログにはアクセストークンの全文を出さない(`log-safe.js`)」を 1 項目足す。
5. 「2. 環境変数の設定」: `cp .env.example .env` を消し、「`server/` に `.env` を作成して次の内容を書く」とする(続く `.env` の例はそのまま)。

### E. `SETUP.md`

1. 「6. ブラウザでアクセス」: `http://localhost:5500` を `http://localhost:5500/roulette/` に直し、文案M を足す。`FRONTEND_URL=http://localhost:5500`(「4. バックエンドのセットアップ」の `.env` 例、トラブルシューティングの「CORS エラー」)は変えない。
2. 「デプロイ」→「自動デプロイ」: `git add` / `git commit` / push のコード例を消し、文案P に置き換える。
6. 「4. バックエンドのセットアップ」: `cp .env.example .env` の行を消し、「`server/.env` を作成して Discord Bot トークンを設定」とする(続く `.env` の例はそのまま)。
3. 「デプロイの確認」「手動デプロイ」はそのまま。
4. 「トラブルシューティング」→「ビルドが失敗する」に 1 行足す: デプロイ前検証(lint・テスト・ビルド・モック混入チェック)で落ちた場合は、Actions のログで落ちたステップを確認し、ローカルで `npm run lint`・`npm test`・`npm run build` を実行して再現する。
5. 「ビルドコマンド」節には `npm test`・`npm run lint` を足さず、README の「開発」節を参照する 1 行を足す(同じ一覧を 2 か所に持たない)。

## 実装ステップ

1 ファイル 1 タスクにする。3 タスクは互いに別のファイルしか触らず、結果にも依存しないため並列で実行する。

- [ ] タスク1: `README.md` を上記 A・B・C のとおり編集する
- [ ] タスク2: `server/README.md` を上記 D のとおり編集する
- [ ] タスク3: `SETUP.md` を上記 E のとおり編集する

言い回しの統一(3 ファイルで同じことを書く箇所)は、各タスクの指示に同じ文案を渡してそろえる。

## テスト戦略

コードは変わらないので、確認は「既存の検証が通ること」と「README の記述が実ファイル・実装と一致していること」の 2 つ。

- `npm run lint`・`npm test`・`npm run build` がすべて成功する(ドキュメントだけの変更で壊れていないことの確認。CI の `verify` と同じ)。
- 次の機械的なチェックがすべて満たされる:
  - 3 ファイルとも `?token=xxx` が 0 件。
  - 3 ファイルとも `git push origin main` が 0 件(地の文にも書かない指示のため、全文で 0 件)。
  - 3 ファイルとも `server/` 側の手順で `cp .env.example .env` を使っていない(ルートの「フロントエンドのセットアップ」と SETUP.md「3. 環境変数を設定」の `cp .env.example .env` は残る)。
  - 3 ファイルとも `FRONTEND_URL=http://localhost:5500/roulette` で始まる行が 0 件(既存の行は変えず、新しく足す行にも `/roulette/` を付けない)。
  - `README.md`・`server/README.md` に `x-access-token` が 1 件以上。
  - `README.md`・`SETUP.md` に `localhost:5500/roulette/` が 1 件以上。
  - `server/README.md` の 401 のエラーメッセージ 3 種類が `server/index.js` の文言と完全に一致する。
  - 構造図に載せたパス(ファイル・ディレクトリ)がすべてワークツリーに存在する。
  - 3 ファイルに書いた npm スクリプト名がすべて対応する `package.json`(ルートまたは `server/`)の `scripts` に存在する。
- 目視: GitHub 上(PR の Files changed の rich diff)で 3 ファイルの Markdown が崩れずに表示される。

**自動テストを新規作成するか:** しない(理由: 変更は Markdown の文書のみで、実行されるコードがない。記述の正しさは上の機械的なチェックで確認でき、README の内容を検査するテストを常設すると README を直すたびにテストも直す手間が増えるだけになる)。

## リスク・トレードオフ

- README を細かく書くほど、次に構成が変わったときにまたずれる。構造図ではディレクトリの中身を列挙しすぎない(`js/animations/`・`js/dev/`・`tests/unit/` は中身を書かない)ことで抑える。
- 3 ファイルで同じことを別々に書くため、言い回しや内容が食い違うおそれがある。タスクの指示に同じ文案を渡し、コードレビューで 3 ファイルを突き合わせる。
- `main` へのマージで `deploy.yml` が走るが、文書はビルド成果物に含まれないため本番の見た目は変わらない。
- `server/README.md` を変えるので、`main` へのマージで Render の自動デプロイが走る([render-root-dir-autodeploy](../memory/entries/render-root-dir-autodeploy.md))。サーバーのコードは同じなので動作は変わらないが、再起動の間(数十秒〜数分)は Bot と API が応答しない。使われていない時間帯にマージする。

## ロールバック方針

文書だけの変更なので、問題があればマージコミットを revert する PR を出す(revert でも `server/` が変わるため Render の再デプロイが走る)。

## 設計レビュー結果

`design-reviewer` による自動レビュー(最大2ラウンド、`/design` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | 事実の裏取りはすべて一致。MINOR 9 件: `server/.env.example` が無いのに手順が `cp` している(→ C-5・D-5・E-6 で反映)、`/api/guild/channels` の例に `memberCount` が無い(→ D-1 で反映)、`FRONTEND_URL` は CORS に使われていない・README の特徴がルーレット演出だけ(→ スコープ外としてフォローアップに記録)、共通文案が無い(→「共通文案」節を追加)、挿入位置の曖昧さ(→ C-3・D-3 で明記)、変えてはいけない `localhost:5500`(→ C-1・E-1 で明記)、機械チェックと地の文の衝突(→ 文字列自体を書かない指示に)、構造図にルートの `package.json` が無い(→ B に追加) |

未解決のMAJORが残った場合: なし

## コードレビュー結果

`code-reviewer` による自動レビュー(最大2ラウンド、`/implement` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 |  |  |

未解決のMAJORが残った場合: (未実施)

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |

## 壁打ちの記録

- Q1 範囲: `server/README.md` と `SETUP.md` の同じずれも今回直す(推奨は README のみだったが、人間の判断で 3 ファイルに拡大)。これに合わせて D・E を追加し、実装を 3 タスクに分け、Render の再デプロイをリスクに追加した。
- Q2 「開発」節の新設と技術スタックへの開発ツールの追記: 推奨案どおり。
- Q3 API 説明に 401 まで書く: 推奨案どおり。`server/README.md` には 401 の応答例も載せる。

---

スキル化候補: [[render-root-dir-autodeploy]](related_topics 3件: node24-upgrade, token-log-masking, readme-refresh)
