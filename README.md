# Discord ボイスルーレット

Discord のボイスチャネルに参加しているメンバーから指定人数をランダムに選出する Web アプリケーション

## 特徴

- 🎰 4 種類の演出（円形ルーレット・スロットマシン・カードめくり・ドラムロール）
- ⏱️ 1 人あたりの演出時間を 3〜10 秒で調整（初期値 6 秒）
- 🎯 白線回避機能（円形ルーレットで針がセクション中央に停止）
- 🚫 参加者除外機能（チェックボックスで除外）
- 🎭 ランダムロール付与機能（役職をシャッフル割り当て）
- 🔒 Discord スラッシュコマンドによるアクセス制御
- ⚡ 完全クライアントサイド（フロントエンド）
- 🤖 Discord Bot による API アクセス（バックエンド）

## アーキテクチャ

```
[Discord]                [バックエンド]           [フロントエンド]
/roulette コマンド  -->  Node.js サーバー   <-->  GitHub Pages
                         (Bot + REST API)         (静的サイト)
```

## 使い方

### 1. Discord で `/roulette` コマンドを実行

Discord サーバーのチャットで以下のコマンドを入力:

```
/roulette
```

### 2. Bot が URL を返信

Bot から以下のようなメッセージが届きます:

```
🎰 ボイスルーレットの URL を生成しました！

https://your-app.github.io?token=abc123...

⏰ この URL は1時間有効です。
```

### 3. URL にアクセスしてルーレット実行

1. URL をクリックしてアクセス
2. ボイスチャネルを選択
3. 除外したいメンバーがいる場合、チェックボックスで除外
4. 選出人数を入力
5. （オプション）ロール入力欄に役職を入力（ランダム割り当て）
6. アニメーション方式（円形ルーレット・スロットマシン・カードめくり・ドラムロール）を選ぶ
7. 1 人あたりのアニメーション時間（3〜10 秒）を選ぶ
8. 「ルーレット開始」をクリック
9. 選んだ方式の演出で、選出されたメンバーが順に決まる
10. 「結果を見る」をクリックすると結果が表示される（ロール付き）

## セットアップ

### 前提条件

- Node.js（v24）
- Discord Bot アカウント
- GitHub アカウント
- Render アカウント（無料）

### 1. Discord Bot の作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリック
3. アプリケーション名を入力（例: "Voice Roulette Bot"）
4. 「Bot」タブで「Add Bot」をクリック
5. Bot トークンをコピーして保存
6. 「Privileged Gateway Intents」で以下を有効化:
   - ✅ SERVER MEMBERS INTENT
   - ✅ PRESENCE INTENT（オプション）

### 2. Bot をサーバーに招待

1. 「OAuth2」→「URL Generator」を選択
2. 「SCOPES」で `bot` と `applications.commands` を選択
3. 「BOT PERMISSIONS」で以下を選択:
   - ✅ Read Messages/View Channels
   - ✅ Read Message History
4. 生成された URL をブラウザで開き、Bot を招待

### 3. バックエンドのセットアップ（ローカル）

```bash
cd server
npm install
```

`server/.env` を作成して次の変数を設定してください。

- `DISCORD_BOT_TOKEN`: Bot トークン
- `PORT`: サーバーのポート（省略時は 3000）
- `FRONTEND_URL`: 開発時は `http://localhost:5500`

```bash
npm run dev
```

### 4. フロントエンドのセットアップ（ローカル）

```bash
# ルートディレクトリで
npm install

# 環境変数を設定
cp .env.example .env
# .env ファイルを編集（開発環境ではデフォルトのままでOK）

# 開発サーバーを起動
npm run dev
```

ブラウザで `http://localhost:5500/roulette/` にアクセス

Discord なしで画面を確認するには `http://localhost:5500/roulette/?mock`(プリセットのチャネル)、または `?mock=12`(12 人のチャネルを先頭に追加。1〜100)を開きます。開発サーバー専用で、本番ビルドでは無効です。

### 5. Render へのデプロイ

1. [Render Dashboard](https://dashboard.render.com/) にアクセス
2. 「New +」→「Web Service」を選択
3. GitHub リポジトリを接続
4. 以下の設定を入力:
   - **Name**: discord-voice-roulette-server
   - **Root Directory**: `server`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. 環境変数を設定:
   - `DISCORD_BOT_TOKEN`: Bot トークン
   - `FRONTEND_URL`: `https://yt-glaceon.github.io/roulette`(Bot が返す URL の先頭部分)
6. 「Create Web Service」をクリック

初回作成後は、`server/` を変更したコミットが `main` にマージされると Render に自動デプロイされます(Webhook が遅れて数分〜数十分かかることがあります)。`server/` の外だけの変更ではデプロイされません。

Node バージョンの指定と確認は `server/README.md` を参照。

### 6. GitHub Pages へのデプロイ

#### 6.1 GitHub リポジトリの設定

1. GitHub リポジトリの Settings → Secrets and variables → Actions
2. 「New repository secret」をクリック
3. 以下のシークレットを追加:
   - Name: `VITE_API_URL`
   - Secret: RenderのURL（例: `https://your-app.onrender.com`）

#### 6.2 GitHub Pages の有効化

1. Settings → Pages
2. Source を「GitHub Actions」に設定

#### 6.3 デプロイ

変更の流れは「開発」節を参照。PR を `main` にマージすると `deploy.yml` が走り、デプロイ前検証に通った場合だけ GitHub Pages にデプロイされます。
Actions タブでデプロイの進行状況を確認できます。

## 開発

ルートディレクトリで実行するコマンドです。

| コマンド | 内容 |
| --- | --- |
| `npm test` | Jest でテストを実行（ES Modules のため `--experimental-vm-modules` 付きで実行されます） |
| `npm run test:watch` | テストを監視モードで実行 |
| `npm run test:coverage` | カバレッジ付きでテストを実行 |
| `npm run lint` | ESLint を実行（警告 0 件が必要） |
| `npm run build` | 本番ビルド（`dist/` に出力） |
| `npm run preview` | ビルド結果をローカルで確認 |

`server/` に独自のテストスクリプトは無く、`server/log-safe.js` のテストはルートの `npm test` に含まれます（`tests/unit/server-log-safe.test.js`）。

### 変更の流れ

`main` はブランチ保護により PR 必須で、CI の `verify` が通るまでマージできません(直接プッシュはできません)。

1. `main` から作業ブランチを切って変更する
2. PR を作ると CI(`.github/workflows/ci.yml` の `verify`)が走る
3. `verify` が通ったら PR をマージする
4. `main` へのマージで `deploy.yml` が走り、デプロイ前検証(`pre-deploy-verify`、CI と同じ検証)に通った場合だけ GitHub Pages にデプロイされる

CI では lint → `node --check server/index.js` → テスト → ビルド → 本番ビルドにモックが混入していないかの確認を順に実行します（`.github/actions/verify`）。

## 技術スタック

### バックエンド
- Node.js
- Express
- discord.js v14
- Render（ホスティング）

### フロントエンド
- HTML/CSS/JavaScript（Vanilla）
- Canvas API（ルーレットアニメーション）
- GitHub Pages（ホスティング）

### 開発ツール
- Vite
- Jest（jsdom）+ fast-check
- ESLint
- GitHub Actions

## プロジェクト構造

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

## API エンドポイント

`/api/` で始まるエンドポイントには、Discord の `/roulette` コマンドで発行されたアクセストークンを `x-access-token` リクエストヘッダで送ります。トークンが無い・無効・期限切れの場合は `401` を返します。Bot が返す URL の `?token=` はフロントエンドが読み取り、API にはヘッダで送ります(URL のクエリでは API に渡しません)。

### `GET /api/validate-token`
トークンを検証

### `GET /api/guild`
ギルド情報を取得

### `GET /api/guild/channels`
ボイスチャネル一覧を取得

### `GET /api/guild/channels/:channelId/members`
ボイスチャネルメンバー一覧を取得

## トラブルシューティング

### Bot がオンラインにならない
- `DISCORD_BOT_TOKEN` が正しいか確認
- Bot の Intents が有効になっているか確認（Developer Portal）

### スラッシュコマンドが表示されない
- Bot がサーバーに招待されているか確認
- サーバーを再起動してコマンドを再登録

### トークンが無効
- トークンは1時間で失効します
- Discord で `/roulette` コマンドを再実行して新しい URL を取得

### CORS エラー
- フロントエンドを開いているオリジンが `server/index.js` の `allowedOrigins` に含まれているか確認（`FRONTEND_URL` は CORS には使われません）
- 別のオリジンで公開する場合は `allowedOrigins` に追加

### Bot が返す URL が違う場所を指す
- `FRONTEND_URL` が正しいか確認（Bot が返す URL の先頭部分になる）

## セキュリティ

- トークンベースのアクセス制御
- トークンは1時間で自動失効
- 期限切れトークンは自動削除
- CORS で許可するオリジンを制限（`server/index.js` の `allowedOrigins`）
- アクセストークンは URL ではなくヘッダで API に送り、サーバーのログには全文を出さない（`server/log-safe.js`）
- Bot トークンは環境変数で管理

## ライセンス

MIT
