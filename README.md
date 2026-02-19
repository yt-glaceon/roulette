# Discord ボイスルーレット

Discord のボイスチャネルに参加しているメンバーから指定人数をランダムに選出する Web アプリケーション

## 特徴

- 🎰 円グラフ型のルーレットアニメーション
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
3. 選出人数を入力
4. 「ルーレット開始」をクリック
5. 円グラフ型のルーレットが回転
6. 結果が表示される

## セットアップ

### 前提条件

- Node.js（v18 以上）
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
cp .env.example .env
# .env ファイルを編集して DISCORD_BOT_TOKEN を設定
npm run dev
```

### 4. フロントエンドの起動（ローカル）

```bash
# Live Server 拡張機能を使用
# または
python -m http.server 5500
```

ブラウザで `http://127.0.0.1:5500` にアクセス

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
   - `FRONTEND_URL`: GitHub Pages の URL
6. 「Create Web Service」をクリック

### 6. GitHub Pages へのデプロイ

1. GitHub リポジトリの Settings → Pages
2. Source を「main」ブランチに設定
3. `js/config.js` を編集:
   ```javascript
   return 'https://your-app.onrender.com';
   ```
4. コミット & プッシュ

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

## プロジェクト構造

```
.
├── index.html              # メインHTML
├── css/
│   └── style.css          # スタイルシート
├── js/
│   ├── app-controller.js  # アプリケーションコントローラー
│   ├── config.js          # 設定ファイル
│   ├── discord-client.js  # Discord APIクライアント
│   ├── roulette-engine.js # ルーレットロジック
│   ├── roulette-wheel.js  # ルーレットアニメーション
│   ├── ui-controller.js   # UI制御
│   └── result-manager.js  # 結果管理
├── server/                # バックエンドサーバー
│   ├── index.js          # サーバーエントリーポイント
│   ├── package.json      # 依存関係
│   └── README.md         # サーバードキュメント
└── README.md             # このファイル
```

## API エンドポイント

### `GET /api/validate-token?token=xxx`
トークンを検証

### `GET /api/guild?token=xxx`
ギルド情報を取得

### `GET /api/guild/channels?token=xxx`
ボイスチャネル一覧を取得

### `GET /api/guild/channels/:channelId/members?token=xxx`
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
- `FRONTEND_URL` が正しく設定されているか確認
- フロントエンドの URL と完全に一致する必要があります

## セキュリティ

- トークンベースのアクセス制御
- トークンは1時間で自動失効
- 期限切れトークンは自動削除
- CORS 設定でフロントエンドからのアクセスのみ許可
- Bot トークンは環境変数で管理

## ライセンス

MIT
