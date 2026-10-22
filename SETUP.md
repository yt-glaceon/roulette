# セットアップガイド

このドキュメントでは、Discord ボイスルーレットアプリケーションのセットアップ手順を詳しく説明します。

## 目次

1. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
2. [GitHub Actionsの設定](#github-actionsの設定)
3. [デプロイ](#デプロイ)
4. [トラブルシューティング](#トラブルシューティング)

## ローカル開発環境のセットアップ

### 前提条件

- Node.js v24
- npm または yarn
- Git

### 手順

1. **リポジトリをクローン**

```bash
git clone https://github.com/your-username/discord-voice-roulette.git
cd discord-voice-roulette
```

2. **フロントエンドの依存関係をインストール**

```bash
npm install
```

3. **環境変数を設定**

```bash
cp .env.example .env
```

`.env` ファイルを編集（開発環境ではデフォルトのままでOK）:

```env
VITE_API_URL=http://localhost:3000
```

4. **バックエンドのセットアップ**

```bash
cd server
npm install
```

`server/.env` を作成して Discord Bot トークンを設定:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
FRONTEND_URL=http://localhost:5500
```

`FRONTEND_URL` は、Bot が `/roulette` コマンドへの返信で送る URL の先頭部分です（例: `https://yt-glaceon.github.io/roulette`。未設定の場合は `http://127.0.0.1:5500`）。CORS で許可するオリジンは環境変数ではなく `server/index.js` の `allowedOrigins` で決めています（`https://yt-glaceon.github.io`・`http://localhost:5500`・`http://127.0.0.1:5500`）。オリジンはスキーム・ホスト・ポートまで完全一致で判定します。別のオリジンでフロントエンドを公開する場合は `allowedOrigins` に追加してください。

5. **開発サーバーを起動**

ターミナルを2つ開いて、それぞれで以下を実行:

**ターミナル1（フロントエンド）:**
```bash
npm run dev
```

**ターミナル2（バックエンド）:**
```bash
cd server
npm run dev
```

6. **ブラウザでアクセス**

`http://localhost:5500/roulette/` にアクセスしてアプリケーションを確認

Discord なしで画面を確認するには `http://localhost:5500/roulette/?mock`（プリセットのチャネル）、または `?mock=12`（12 人のチャネルを先頭に追加。1〜100）を開きます。開発サーバー専用で、本番ビルドでは無効です。

## GitHub Actionsの設定

### 1. GitHub リポジトリでシークレットを設定

1. GitHub リポジトリにアクセス
2. Settings → Secrets and variables → Actions
3. 「New repository secret」をクリック
4. 以下のシークレットを追加:

| Name | Value | 説明 |
|------|-------|------|
| `VITE_API_URL` | `https://your-app.onrender.com` | RenderにデプロイしたバックエンドのURL |

### 2. GitHub Pages を有効化

1. Settings → Pages
2. Source を「GitHub Actions」に設定
3. 保存

## デプロイ

### 自動デプロイ

`main` はブランチ保護により PR 必須で、CI の `verify` が通るまでマージできません（直接プッシュはできません）。

1. `main` から作業ブランチを切って変更する
2. PR を作ると CI（`.github/workflows/ci.yml` の `verify`）が走る
3. `verify` が通ったら PR をマージする
4. `main` へのマージで `deploy.yml` が走り、デプロイ前検証（`pre-deploy-verify`、CI と同じ検証）に通った場合だけ GitHub Pages にデプロイされる

### デプロイの確認

1. GitHub リポジトリの「Actions」タブを開く
2. 最新のワークフロー実行を確認
3. すべてのステップが成功したら、GitHub Pages の URL にアクセス

### 手動デプロイ

GitHub の Actions タブから手動でワークフローを実行することもできます:

1. Actions タブを開く
2. 「Deploy to GitHub Pages」ワークフローを選択
3. 「Run workflow」をクリック

## トラブルシューティング

### ビルドが失敗する

**症状**: GitHub Actions でビルドが失敗する

**原因**: `VITE_API_URL` シークレットが設定されていない

**解決方法**:
1. Settings → Secrets and variables → Actions
2. `VITE_API_URL` が正しく設定されているか確認
3. 値が正しいか確認（例: `https://your-app.onrender.com`）

デプロイ前検証（lint・テスト・ビルド・モック混入チェック）で落ちた場合は、Actions のログで落ちたステップを確認し、ローカルで `npm run lint`・`npm test`・`npm run build` を実行して再現します。

### 環境変数が undefined になる

**症状**: `import.meta.env.VITE_API_URL` が `undefined`

**原因**: 環境変数名が `VITE_` で始まっていない

**解決方法**:
- 環境変数名は必ず `VITE_` で始める必要があります
- `.env` ファイルで `VITE_API_URL=...` と設定

### ローカルで開発サーバーが起動しない

**症状**: `npm run dev` でエラーが発生

**原因**: 依存関係がインストールされていない

**解決方法**:
```bash
npm install
```

### CORS エラーが発生する

**症状**: ブラウザのコンソールに CORS エラーが表示される

**原因**: フロントエンドを開いているオリジンが、バックエンドの許可リスト（`server/index.js` の `allowedOrigins`）に含まれていない

**解決方法**:
1. ブラウザのアドレスバーのオリジン（例: `http://localhost:5500`）を確認
2. `server/index.js` の `allowedOrigins` に含まれているか確認（完全一致で判定するため、末尾の `/` やポート・スキームの違いも不一致になります）
3. 含まれていなければ追加してバックエンドを再起動・再デプロイ

`FRONTEND_URL` は CORS には使われません。

## 環境変数の管理

### 開発環境

`.env` ファイルで管理:

```env
VITE_API_URL=http://localhost:3000
```

### 本番環境

GitHub Secrets で管理:

- `VITE_API_URL`: RenderのURL

### 環境変数の追加

新しい環境変数を追加する場合:

1. `.env.example` に追加（ドキュメント用）
2. `.env` に追加（ローカル開発用）
3. GitHub Secrets に追加（本番環境用）
4. `vite.config.js` で `envPrefix` を確認（`VITE_` で始まる必要がある）

## ビルドコマンド

### 開発ビルド

```bash
npm run dev
```

### 本番ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに生成されます。

テスト・lint などの開発用コマンドは、README の「開発」節を参照してください。

### プレビュー

本番ビルドをローカルでプレビュー:

```bash
npm run preview
```

## 参考リンク

- [Vite 公式ドキュメント](https://vitejs.dev/)
- [GitHub Actions 公式ドキュメント](https://docs.github.com/ja/actions)
- [GitHub Pages 公式ドキュメント](https://docs.github.com/ja/pages)
