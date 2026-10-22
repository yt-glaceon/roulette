# 設計: README・SETUP.md・server/README.md を現状の実装に合わせて更新する(readme-refresh)

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-22-readme-refresh.md](../investigations/2026-10-22-readme-refresh.md)
- 承認者: yt-glaceon
- 承認日: 2026-10-22

## 目的・スコープ

ルートの `README.md` のうち、実装・運用と食い違っている 3 点を直す。壁打ちで、同じずれがある `server/README.md` と `SETUP.md` も今回直すことになった(調査の案C)。各ファイルの既存の節立てと文体(です・ます調、見出しの番号付け、特徴一覧の絵文字)は保つ。

### やること

1. 「API エンドポイント」節: トークンをクエリ `?token=xxx` で渡す記述をやめ、`x-access-token` リクエストヘッダで送ることを書く。
2. 「プロジェクト構造」節: 構造図を実際のファイル配置に合わせる。
3. 開発・CI・デプロイの説明を現状に合わせる(フロントの開発サーバーの URL、モック、テスト・lint・ビルドのコマンド、PR と CI を経由したデプロイの流れ)。
4. `server/README.md` の API 説明とデプロイ説明を同じ内容に合わせる(下記 D)。
5. `SETUP.md` の開発サーバーの URL とデプロイ説明を同じ内容に合わせる(下記 E)。
6. 3 ファイルで `FRONTEND_URL` を「CORS 用」と説明している箇所を、実装どおり「Bot が返す URL の組み立てに使う」に直し、CORS は `server/index.js` の許可リストで判定すると書く(下記 F。ゲート1の修正依頼で追加)。
7. README の「特徴」「使い方」を、4 種類の演出と演出時間の選択に合わせる(下記 G。ゲート1の修正依頼で追加)。

### やらないこと(スコープ外)

- README の全面的な書き直し・節の並べ替え(調査の案B)。
- コード・設定ファイルの変更。
- 上の 3 ファイル以外の文書(`docs/`・`.kiro/specs/` など)。
- 3 ファイルのうち、今回のずれと関係のない記述の書き直し(例: SETUP.md のトラブルシューティングの既存項目、`your-username` などのプレースホルダー)。
- `server/.env.example` ファイルの新規作成(手順の文言だけを直す。下記 C-4・D-5・E-3)。
- `allowedOrigins` の判定が前方一致(`origin.startsWith(allowed)`)で、`https://yt-glaceon.github.io.attacker.example` のようなオリジンや Origin の無いリクエストも通る件。コードの修正になるため別トピックで扱う(PR 本文にフォローアップとして書く)。文書では「フロントエンドからのアクセスのみ許可」と言い切らない(F の README.md-3)。
- CORS の許可リストを環境変数に移すなど、コード側の変更(文書を実装に合わせるだけにする)。

## アーキテクチャ・変更概要

変更するファイルは `README.md`・`server/README.md`・`SETUP.md` の 3 つ。A〜C・G は `README.md`、D は `server/README.md`、E は `SETUP.md` の変更。F は 3 ファイルにまたがるので、ファイルごとの項目を F に列挙し、各タスクが自分のファイルの分だけを行う。3 ファイルで同じことを書く箇所は、下の「共通文案」をそのまま使う(各ファイルの見出しレベルや前後の文に合わせた最小限の調整は可)。

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

**文案F(`FRONTEND_URL` と CORS)** — F で使う:

> `FRONTEND_URL` は、Bot が `/roulette` コマンドへの返信で送る URL の先頭部分です(例: `https://yt-glaceon.github.io/roulette`。未設定の場合は `http://127.0.0.1:5500`)。CORS で許可するオリジンは環境変数ではなく `server/index.js` の `allowedOrigins` で決めています(`https://yt-glaceon.github.io`・`http://localhost:5500`・`http://127.0.0.1:5500`)。別のオリジンでフロントエンドを公開する場合は `allowedOrigins` に追加してください。

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
│   ├── animations/          # 演出(円形ルーレット・スロットマシン・カードめくり・ドラムロール、時間配分の計算)
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
   - 「`server/` に独自のテストスクリプトは無い。`server/log-safe.js` のテストはルートの `npm test` に含まれる(`tests/unit/server-log-safe.test.js`)」と 1 行で書く。
   - 変更の流れ: 文案P を載せる。
   - CI の中身を 1 行で書く: lint → `node --check server/index.js` → テスト → ビルド → 本番ビルドにモックが混入していないかの確認(`.github/actions/verify`)。
3. 「6.3 デプロイ」
   - `git add` / `git commit` / push のコード例を消し、「変更の流れは「開発」節を参照。PR を `main` にマージすると `deploy.yml` が走り、デプロイ前検証に通った場合だけ GitHub Pages にデプロイされます。」に置き換える。進行状況は Actions タブで確認できる、という既存の文は残す。
   - 「5. Render へのデプロイ」の手順 6(「Create Web Service」)の後、「Node バージョンの指定と確認は `server/README.md` を参照。」の前に、文案R を足す。
4. 「3. バックエンドのセットアップ(ローカル)」: `server/` に `.env.example` は無いので、`cp .env.example .env` の行を消し、「`server/.env` を作成して次の変数を設定」とし、`DISCORD_BOT_TOKEN`・`PORT`(省略時 3000)・`FRONTEND_URL`(開発時は `http://localhost:5500`)を書く。ルートの `.env.example` はあるので「4. フロントエンドのセットアップ」の `cp .env.example .env` はそのまま。
5. 「技術スタック」節に「### 開発ツール」を足す: Vite、Jest(jsdom)+ fast-check、ESLint、GitHub Actions。

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

### F. `FRONTEND_URL` と CORS の説明(3 ファイル)

実装の事実: `FRONTEND_URL` は `server/index.js:90-91` で Bot が返す URL(`${FRONTEND_URL}?token=...`)を組み立てるのにだけ使う。CORS は `server/index.js:125-138` の `allowedOrigins`(ハードコード)とリクエストの `Origin` の前方一致で判定する。`FRONTEND_URL` の値は CORS に影響しない。

- `README.md`
  1. 「トラブルシューティング」→「CORS エラー」の 2 項目を次に置き換える: 「フロントエンドを開いているオリジンが `server/index.js` の `allowedOrigins` に含まれているか確認(`FRONTEND_URL` は CORS には使われません)」「別のオリジンで公開する場合は `allowedOrigins` に追加」。
  2. 「トラブルシューティング」に「### Bot が返す URL が違う場所を指す」を足し、「`FRONTEND_URL` が正しいか確認(Bot が返す URL の先頭部分になる)」と書く。
  3. 「セキュリティ」節の「CORS 設定でフロントエンドからのアクセスのみ許可」を「CORS で許可するオリジンを制限(`server/index.js` の `allowedOrigins`)」に置き換える(判定が前方一致のため「のみ許可」と言い切らない)。
  4. 「5. Render へのデプロイ」の手順 5 の `FRONTEND_URL`: GitHub Pages の URL を「`FRONTEND_URL`: `https://yt-glaceon.github.io/roulette`(Bot が返す URL の先頭部分)」にする(server/README.md の 68・175 行目と同じ値)。
- `server/README.md`
  1. `.env` の例のコメント `# フロントエンドURL（CORS設定用）` を `# フロントエンドURL（Bot が返す URL の先頭部分）` に直す。
  2. 環境変数表の `FRONTEND_URL` の説明「フロントエンドのURL（CORS用）」を「Bot が返す URL の先頭部分（未設定時は `http://127.0.0.1:5500`）」に直す。
  - server/README.md と README.md の既存の括弧の表記(全角か半角か)は、各ファイルのその箇所の周りに合わせる。
  3. 環境変数表の後に「### CORS」小見出しを足し、文案F のうち CORS の 2 文(「CORS で許可するオリジンは…」以降)を書く。
  4. 「トラブルシューティング」→「CORS エラー」を README の F-1 と同じ内容に置き換える。同じ節に README の F-2 と同じ項目を足す。
  5. 「機能」節の「CORS 設定」はそのまま。
- `SETUP.md`
  1. 「4. バックエンドのセットアップ」の `.env` の例の後に、文案F の 1 文目(`FRONTEND_URL` の説明)を書く。
  2. 「トラブルシューティング」→「CORS エラーが発生する」の **原因** と **解決方法** を次に置き換える: 原因「フロントエンドを開いているオリジンが、バックエンドの許可リスト(`server/index.js` の `allowedOrigins`)に含まれていない」、解決方法「1. ブラウザのアドレスバーのオリジン(例: `http://localhost:5500`)を確認 2. `server/index.js` の `allowedOrigins` に含まれているか確認 3. 含まれていなければ追加してバックエンドを再起動・再デプロイ」。「`FRONTEND_URL` は CORS には使われません」と添える。

### G. README の「特徴」「使い方」

実装の事実: `index.html:32-45` で演出を「円形ルーレット」「スロットマシン」「カードめくり」「ドラムロール」の 4 つから選び、演出時間をスライダーで 3〜10 秒(初期値 6 秒、1 秒刻み)から選ぶ。演出が終わると「結果を見る」ボタンが出て、押すと結果画面に移る(`index.html:49-52`)。

1. 「特徴」節
   - 「🎰 円グラフ型のルーレットアニメーション(6秒間回転)」を「🎰 4 種類の演出(円形ルーレット・スロットマシン・カードめくり・ドラムロール)」に置き換える。
   - その次に「⏱️ 1 人あたりの演出時間を 3〜10 秒で調整(初期値 6 秒)」を足す(時間は選出する 1 人ごとの演出に渡される。`ui-controller.js:690`)。
   - 「🎯 白線回避機能(針がセクション中央に停止)」は「🎯 白線回避機能(円形ルーレットで針がセクション中央に停止)」にする。
   - ほかの項目はそのまま。
2. 「使い方」節の「3. URL にアクセスしてルーレット実行」の手順を次にする(既存の 1〜5 はそのまま):
   6. アニメーション方式(円形ルーレット・スロットマシン・カードめくり・ドラムロール)を選ぶ
   7. 1 人あたりのアニメーション時間(3〜10 秒)を選ぶ
   8. 「ルーレット開始」をクリック
   9. 選んだ方式の演出で、選出されたメンバーが順に決まる
   10. 「結果を見る」をクリックすると結果が表示される(ロール付き)

### E. `SETUP.md`

1. 「6. ブラウザでアクセス」: `http://localhost:5500` を `http://localhost:5500/roulette/` に直し、文案M を足す。「4. バックエンドのセットアップ」の `.env` 例の `FRONTEND_URL=http://localhost:5500` は変えない。トラブルシューティングの「CORS エラーが発生する」は F の SETUP.md-2 に従う。
2. 「デプロイ」→「自動デプロイ」: `git add` / `git commit` / push のコード例を消し、文案P に置き換える。
3. 「4. バックエンドのセットアップ」: `cp .env.example .env` の行を消し、「`server/.env` を作成して Discord Bot トークンを設定」とする(続く `.env` の例はそのまま)。
4. 「デプロイの確認」「手動デプロイ」はそのまま。
5. 「トラブルシューティング」→「ビルドが失敗する」に 1 行足す: デプロイ前検証(lint・テスト・ビルド・モック混入チェック)で落ちた場合は、Actions のログで落ちたステップを確認し、ローカルで `npm run lint`・`npm test`・`npm run build` を実行して再現する。
6. 「ビルドコマンド」節には `npm test`・`npm run lint` を足さず、README の「開発」節を参照する 1 行を足す(同じ一覧を 2 か所に持たない)。

## 実装ステップ

1 ファイル 1 タスクにする。3 タスクは互いに別のファイルしか触らず、結果にも依存しないため並列で実行する。

- [x] タスク1: `README.md` を上記 A・B・C・G と F の `README.md` 分のとおり編集する
- [x] タスク2: `server/README.md` を上記 D と F の `server/README.md` 分のとおり編集する
- [x] タスク3: `SETUP.md` を上記 E と F の `SETUP.md` 分のとおり編集する

実装の記録(3 タスクを 1 ウェーブで implementer 3 体に並列 dispatch。タスク管理ツールが無い環境のため、状態はデスクトップアプリのタスクリストで管理):

| タスク | 結果 | コミット | 備考 |
| --- | --- | --- | --- |
| タスク1 README.md | 完了 | 8bba0a9 | 共通文案は半角括弧、地の文は全角括弧で混在 |
| タスク2 server/README.md | 完了 | 8c8d308 | 括弧は周りに合わせて全角 |
| タスク3 SETUP.md | 完了 | e392b2d | F の SETUP.md-1 で「文案F の 1 文目」の指定に対し全文(CORS の 2 文を含む)を入れた |

言い回しの統一(3 ファイルで同じことを書く箇所)は、各タスクの指示に同じ文案を渡してそろえる。

## テスト戦略

コードは変わらないので、確認は「既存の検証が通ること」と「README の記述が実ファイル・実装と一致していること」の 2 つ。

- `npm run lint`・`npm test`・`npm run build` がすべて成功する(ドキュメントだけの変更で壊れていないことの確認。CI の `verify` と同じ)。
- 次の機械的なチェックがすべて満たされる:
  - 3 ファイルとも `?token=xxx` が 0 件。
  - 3 ファイルとも `git push origin main` が 0 件(地の文にも書かない指示のため、全文で 0 件)。
  - 3 ファイルとも `server/` 側の手順で `cp .env.example .env` を使っていない(ルートの「フロントエンドのセットアップ」と SETUP.md「3. 環境変数を設定」の `cp .env.example .env` は残る)。
  - 3 ファイルとも `FRONTEND_URL=http://localhost:5500/roulette` で始まる行が 0 件(既存の行は変えず、新しく足す行にも `/roulette/` を付けない)。
  - 3 ファイルとも `CORS用`・`CORS設定用`・`CORS 用` が 0 件。
  - 3 ファイルとも「フロントエンドの URL と完全に一致する必要があります」が 0 件。
  - `SETUP.md` に「バックエンドの `FRONTEND_URL` が正しく設定されていない」が 0 件。
  - `README.md` の F-1・F-2 と `server/README.md` の F-4 の文面が一致する(コードレビューで突き合わせる)。
  - 3 ファイルに書いた `allowedOrigins` の 3 つのオリジンが `server/index.js` の `allowedOrigins` と一致する。
  - `README.md` に `6秒間回転` が 0 件で、`スロットマシン`・`カードめくり`・`ドラムロール`・`結果を見る` がそれぞれ 1 件以上。`index.html` の選択肢の名前・ボタン名・時間の範囲(3〜10 秒、初期値 6 秒)と一致する。
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
| 1 | PASS | 事実の裏取りはすべて一致。MINOR 9 件: `server/.env.example` が無いのに手順が `cp` している(→ C-4・D-5・E-3 で反映)、`/api/guild/channels` の例に `memberCount` が無い(→ D-1 で反映)、`FRONTEND_URL` は CORS に使われていない・README の特徴がルーレット演出だけ(→ スコープ外としてフォローアップに記録)、共通文案が無い(→「共通文案」節を追加)、挿入位置の曖昧さ(→ C-3・D-3 で明記)、変えてはいけない `localhost:5500`(→ C-1・E-1 で明記)、機械チェックと地の文の衝突(→ 文字列自体を書かない指示に)、構造図にルートの `package.json` が無い(→ B に追加) |
| 2(ゲート1の修正依頼で F・G を追加した後) | PASS | F・G の事実はすべて一致。MINOR 7 件をすべて反映: E-1 と F の矛盾(→ E-1 を修正)、`server/` にテストが無いは誤り(→ C-2 を修正)、README の Render 手順の `FRONTEND_URL` 値(→ F の README.md-4 を追加)、CORS の前方一致(→ スコープ外に記録しセキュリティ節の表現を弱める)、演出時間は 1 人あたり(→ G を修正)、F の誤記の残りを検出するチェック(→ テスト戦略に追加)、小番号の順序・表記ゆれ(→ C・E を並べ直し、B の順序と括弧の表記を統一) |

未解決のMAJORが残った場合: なし

## コードレビュー結果

`code-reviewer` による自動レビュー(最大2ラウンド、`/implement` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | 設計どおり・事実はすべて一致・3 ファイル間の食い違いなし・機械チェックすべて OK・`npm run lint`/`npm run build` 成功・Markdown の崩れなし。MINOR 2 件: SETUP.md の F-1 で文案F を全文入れた(→ 内容は実装どおりで読み手に有用なため許容)、README.md で共通文案の括弧だけ半角(→ implementer に全角へ統一させた) |

未解決のMAJORが残った場合: なし

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 修正依頼 | スコープ外にしていた 2 件(`FRONTEND_URL` を CORS 用と書いている件、README の特徴・使い方がルーレット演出だけの前提の件)も今回直す。F・G を追加。Skill 化候補 render-root-dir-autodeploy は保留 |
| 2026-10-22 | 承認 | F・G とラウンド2の指摘を反映した設計で承認 |

## 壁打ちの記録

- Q1 範囲: `server/README.md` と `SETUP.md` の同じずれも今回直す(推奨は README のみだったが、人間の判断で 3 ファイルに拡大)。これに合わせて D・E を追加し、実装を 3 タスクに分け、Render の再デプロイをリスクに追加した。
- Q2 「開発」節の新設と技術スタックへの開発ツールの追記: 推奨案どおり。
- Q3 API 説明に 401 まで書く: 推奨案どおり。`server/README.md` には 401 の応答例も載せる。

---

スキル化候補: [[render-root-dir-autodeploy]](related_topics 3件: node24-upgrade, token-log-masking, readme-refresh)
