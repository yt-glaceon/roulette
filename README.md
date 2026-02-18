# Discord ボイスルーレット

Discord のボイスチャネルに参加しているメンバーから指定人数をランダムに選出するルーレットアプリケーションです。

## 機能

- Discord OAuth2 認証
- サーバー（ギルド）とボイスチャネルの選択
- ボイスチャネルメンバーのリスト表示
- 指定人数のランダム選出
- 結果のクリップボードコピー
- ルーレット履歴の保存

## セットアップ

### 1. Discord アプリケーションの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックしてアプリケーションを作成
3. 「OAuth2」セクションに移動
4. 「Redirects」に以下の URL を追加:
   ```
   https://yt-glaceon.github.io/roulette/callback.html
   ```
5. Client ID をコピー

### 2. リダイレクト URI の確認

Discord Developer Portal で設定したリダイレクト URI を確認:
```
https://yt-glaceon.github.io/roulette/callback.html
```

※ `js/config.js` の `redirectUri` が正しく設定されているか確認してください。

### 3. GitHub Pages へのデプロイ

1. このリポジトリを GitHub にプッシュ
2. リポジトリの Settings → Pages
3. Source: Deploy from a branch
4. Branch: main / root
5. Save

数分後、以下の URL でアクセス可能になります:
```
https://yt-glaceon.github.io/roulette/?client_id=YOUR_CLIENT_ID
```

**重要**: URL に `?client_id=YOUR_CLIENT_ID` パラメータを必ず追加してください。

## 開発

### テストの実行

```bash
npm install
npm test
```

### ローカル開発

ローカルで開発する場合は、HTTPS が必要です（Discord OAuth2 の要件）。

```bash
# 簡易的な HTTPS サーバーの例
npx http-server -S -C cert.pem -K key.pem
```

## 技術スタック

- HTML5 / CSS3 / JavaScript (ES6+)
- Discord REST API
- GitHub Pages

## ライセンス

MIT
