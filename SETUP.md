# セットアップガイド

このドキュメントでは、Discord ボイスルーレットアプリケーションのセットアップ手順を詳しく説明します。

## 目次

1. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
2. [GitHub Actionsの設定](#github-actionsの設定)
3. [デプロイ](#デプロイ)
4. [トラブルシューティング](#トラブルシューティング)

## ローカル開発環境のセットアップ

### 前提条件

- Node.js v20 以上
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
cp .env.example .env
```

`server/.env` ファイルを編集して Discord Bot トークンを設定:

```env
DISCORD_BOT_TOKEN=your_bot_token_here
FRONTEND_URL=http://localhost:5500
```

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

`http://localhost:5500` にアクセスしてアプリケーションを確認

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

`main` ブランチにプッシュすると、自動的にビルド＆デプロイが実行されます:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

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

**原因**: バックエンドの `FRONTEND_URL` が正しく設定されていない

**解決方法**:
1. `server/.env` を確認
2. `FRONTEND_URL` がフロントエンドのURLと一致しているか確認
3. 開発環境: `http://localhost:5500`
4. 本番環境: GitHub Pages の URL

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

### プレビュー

本番ビルドをローカルでプレビュー:

```bash
npm run preview
```

## 参考リンク

- [Vite 公式ドキュメント](https://vitejs.dev/)
- [GitHub Actions 公式ドキュメント](https://docs.github.com/ja/actions)
- [GitHub Pages 公式ドキュメント](https://docs.github.com/ja/pages)
