# Discord Voice Roulette - Backend Server

Discord Bot を使用してボイスチャネル情報を取得する REST API サーバー

## セットアップ

### 1. 依存関係のインストール

```bash
cd server
npm install
```

### 2. 環境変数の設定

`.env.example` を `.env` にコピーして、必要な値を設定:

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```env
DISCORD_BOT_TOKEN=your_actual_bot_token_here
PORT=3000
FRONTEND_URL=http://localhost:5500
```

### 3. サーバーの起動

開発環境:
```bash
npm run dev
```

本番環境:
```bash
npm start
```

## API エンドポイント

### `GET /`
ヘルスチェック

**レスポンス:**
```json
{
  "status": "ok",
  "bot": "BotName#1234",
  "guilds": 5
}
```

### `GET /api/guilds`
Bot が参加しているギルド一覧を取得

**レスポンス:**
```json
[
  {
    "id": "123456789",
    "name": "My Server",
    "icon": "https://cdn.discordapp.com/..."
  }
]
```

### `GET /api/guilds/:guildId/channels`
特定ギルドのボイスチャネル一覧を取得

**レスポンス:**
```json
[
  {
    "id": "987654321",
    "name": "General Voice",
    "position": 0
  }
]
```

### `GET /api/guilds/:guildId/channels/:channelId/members`
特定ボイスチャネルのメンバー一覧を取得

**レスポンス:**
```json
[
  {
    "id": "111222333",
    "username": "user123",
    "displayName": "User Display Name",
    "avatar": "https://cdn.discordapp.com/..."
  }
]
```

## Render へのデプロイ

### 1. GitHub にプッシュ

```bash
git add .
git commit -m "Add backend server"
git push
```

### 2. Render でサービスを作成

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

### 3. デプロイ完了

デプロイが完了すると、Render が URL を提供します（例: `https://your-app.onrender.com`）

この URL をフロントエンドの設定で使用します。

## トラブルシューティング

### Bot がオンラインにならない
- `DISCORD_BOT_TOKEN` が正しいか確認
- Bot の Intents が有効になっているか確認（Developer Portal）

### CORS エラー
- `FRONTEND_URL` が正しく設定されているか確認
- フロントエンドの URL と完全に一致する必要があります

### メンバーが取得できない
- Bot がサーバーに招待されているか確認
- Bot に必要な権限があるか確認
- SERVER MEMBERS INTENT が有効になっているか確認
