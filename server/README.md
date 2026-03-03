# Discord ボイスルーレット - バックエンドサーバー

Discord Bot と REST API を提供するバックエンドサーバー

## 機能

- Discord Bot（スラッシュコマンド `/roulette`）
- トークンベースのアクセス制御
- REST API（ギルド情報、チャネル情報、メンバー情報）
- CORS 設定

## セットアップ

### 1. 依存関係のインストール

```bash
cd server
npm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集:

```env
# Discord Bot Token
DISCORD_BOT_TOKEN=your_bot_token_here

# サーバーポート
PORT=3000

# フロントエンドURL（CORS設定用）
FRONTEND_URL=http://localhost:5500
```

### 3. サーバーの起動

**開発環境**:

```bash
npm run dev
```

**本番環境**:

```bash
npm start
```

## 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DISCORD_BOT_TOKEN` | Discord Bot のトークン | `MTQ3Mzg2...` |
| `PORT` | サーバーのポート番号 | `3000` |
| `FRONTEND_URL` | フロントエンドのURL（CORS用） | `http://localhost:5500` |

### 本番環境の設定

**Render**:

- `DISCORD_BOT_TOKEN`: Discord Developer Portal から取得
- `PORT`: `3000`（Renderが自動設定）
- `FRONTEND_URL`: `https://yt-glaceon.github.io/roulette`

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

### `GET /api/validate-token?token=xxx`

トークンを検証

**レスポンス:**

```json
{
  "valid": true,
  "guildId": "123456789"
}
```

### `GET /api/guild?token=xxx`

ギルド情報を取得

**レスポンス:**

```json
{
  "id": "123456789",
  "name": "My Server",
  "icon": "https://cdn.discordapp.com/..."
}
```

### `GET /api/guild/channels?token=xxx`

ボイスチャネル一覧を取得

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

### `GET /api/guild/channels/:channelId/members?token=xxx`

ボイスチャネルメンバー一覧を取得

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

## Discord Bot

### スラッシュコマンド

`/roulette` - ボイスルーレットのURLを生成

**生成されるURL**:

```
https://yt-glaceon.github.io/roulette?token=abc123...
```

トークンは1時間有効です。

## デプロイ

### Render へのデプロイ

1. Render Dashboard にアクセス
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
   - `FRONTEND_URL`: `https://yt-glaceon.github.io/roulette`
6. 「Create Web Service」をクリック

## トラブルシューティング

### Bot がオンラインにならない

- `DISCORD_BOT_TOKEN` が正しいか確認
- Bot の Intents が有効になっているか確認（Developer Portal）

### CORS エラー

- `FRONTEND_URL` が正しく設定されているか確認
- フロントエンドの URL と完全に一致する必要があります

### トークンが無効

- トークンは1時間で失効します
- Discord で `/roulette` コマンドを再実行して新しい URL を取得
