# Discord ボイスルーレット - バックエンドサーバー

Discord Bot と REST API を提供するバックエンドサーバー

## 機能

- Discord Bot（スラッシュコマンド `/roulette`）
- トークンベースのアクセス制御
- ログにはアクセストークンの全文を出さない（`log-safe.js`）
- REST API（ギルド情報、チャネル情報、メンバー情報）
- CORS 設定

## セットアップ

### 1. 依存関係のインストール

```bash
cd server
npm install
```

### 2. 環境変数の設定

`server/` に `.env` を作成して次の内容を書く:

```env
# Discord Bot Token
DISCORD_BOT_TOKEN=your_bot_token_here

# サーバーポート
PORT=3000

# フロントエンドURL（Bot が返す URL の先頭部分）
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
| `FRONTEND_URL` | Bot が返す URL の先頭部分（未設定時は `http://127.0.0.1:5500`） | `http://localhost:5500` |

### CORS

CORS で許可するオリジンは環境変数ではなく `server/index.js` の `allowedOrigins` で決めています（`https://yt-glaceon.github.io`・`http://localhost:5500`・`http://127.0.0.1:5500`）。別のオリジンでフロントエンドを公開する場合は `allowedOrigins` に追加してください。

### 本番環境の設定

**Render**:

- `DISCORD_BOT_TOKEN`: Discord Developer Portal から取得
- `PORT`: `3000`（Renderが自動設定）
- `FRONTEND_URL`: `https://yt-glaceon.github.io/roulette`

## API エンドポイント

`/api/` で始まるエンドポイントには、Discord の `/roulette` コマンドで発行されたアクセストークンを `x-access-token` リクエストヘッダで送ります。トークンが無い・無効・期限切れの場合は `401` を返します。Bot が返す URL の `?token=` はフロントエンドが読み取り、API にはヘッダで送ります（URL のクエリでは API に渡しません）。`GET /` のヘルスチェックはトークン不要です。

**401 のレスポンス例:**

```json
{
  "error": "無効なトークンです"
}
```

エラーメッセージは「アクセストークンが必要です」「無効なトークンです」「トークンの有効期限が切れています」の 3 種類です。

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

### `GET /api/validate-token`

トークンを検証

**レスポンス:**

```json
{
  "valid": true,
  "guildId": "123456789"
}
```

### `GET /api/guild`

ギルド情報を取得

**レスポンス:**

```json
{
  "id": "123456789",
  "name": "My Server",
  "icon": "https://cdn.discordapp.com/..."
}
```

### `GET /api/guild/channels`

ボイスチャネル一覧を取得

**レスポンス:**

```json
[
  {
    "id": "987654321",
    "name": "General Voice",
    "position": 0,
    "memberCount": 3
  }
]
```

### `GET /api/guild/channels/:channelId/members`

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

トークンは1時間有効です。フロントエンドがこのトークンを読み取り、API には `x-access-token` ヘッダで送ります。

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

初回作成後は、`server/` を変更したコミットが `main` にマージされると Render に自動デプロイされます（Webhook が遅れて数分〜数十分かかることがあります）。`server/` の外だけの変更ではデプロイされません。

#### Node バージョンの指定と確認

- Node バージョンは `server/package.json` の `engines`（`24.x`）で指定している（ルートの `package.json` も同じ値にそろえている）
- デプロイログの冒頭に出る Node バージョンが 24.22.1 以降か確認する
- 24 系にならない場合は、Render の Environment に `NODE_VERSION=24` を設定する。24 系でもパッチが古い場合は `NODE_VERSION=24.22.1` のように完全指定する（`NODE_VERSION` は `engines` より優先される）

## トラブルシューティング

### Bot がオンラインにならない

- `DISCORD_BOT_TOKEN` が正しいか確認
- Bot の Intents が有効になっているか確認（Developer Portal）

### CORS エラー

- フロントエンドを開いているオリジンが `server/index.js` の `allowedOrigins` に含まれているか確認（`FRONTEND_URL` は CORS には使われません）
- 別のオリジンで公開する場合は `allowedOrigins` に追加

### Bot が返す URL が違う場所を指す

- `FRONTEND_URL` が正しいか確認（Bot が返す URL の先頭部分になる）

### トークンが無効

- トークンは1時間で失効します
- Discord で `/roulette` コマンドを再実行して新しい URL を取得
