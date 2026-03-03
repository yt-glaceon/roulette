# タスクリスト：アニメーション修正と環境変数管理

## 概要

このタスクリストは、Discord ボイスルーレットアプリケーションのバグ修正と環境変数管理の改善に関する実装タスクを定義します。

## タスク

### 1. Viteのセットアップ

- [x] 1.1 Viteをインストール（`npm install vite --save-dev`）
- [x] 1.2 `vite.config.js` を作成
  - [x] 1.2.1 ベースパスを `/roulette/` に設定
  - [x] 1.2.2 ビルド設定を追加
  - [x] 1.2.3 開発サーバー設定を追加
- [x] 1.3 `package.json` にスクリプトを追加
  - [x] 1.3.1 `dev` スクリプト
  - [x] 1.3.2 `build` スクリプト
  - [x] 1.3.3 `preview` スクリプト

### 2. 環境変数の設定

- [x] 2.1 `.env` ファイルを作成（開発環境用）
- [x] 2.2 `.env.example` ファイルを作成（テンプレート）
- [x] 2.3 `.gitignore` を更新
  - [x] 2.3.1 `.env` を追加
  - [x] 2.3.2 `dist/` を追加
- [x] 2.4 `js/config.js` を環境変数ベースに変更
  - [x] 2.4.1 `import.meta.env.VITE_API_URL` を使用
  - [x] 2.4.2 フォールバック処理を追加

### 3. HTMLファイルのパス修正

- [x] 3.1 `index.html` のCSSパスを `/css/style.css` に変更
- [x] 3.2 `index.html` のJSパスを `/js/app-controller.js` に変更

### 4. UIController の修正

- [x] 4.1 `animateRoulette` メソッドを修正
  - [x] 4.1.1 ロール入力フィールドを非表示にする処理を追加
  - [x] 4.1.2 ルーレットホイールに除外後の全メンバーを表示
  - [x] 4.1.3 選出されたメンバーを順に指すように修正
  - [x] 4.1.4 最後のアニメーション終了後1秒待ってからボタンを表示
- [x] 4.2 `showRouletteScreen` メソッドを修正
  - [x] 4.2.1 ロール入力フィールドを表示状態に戻す処理を追加
- [x] 4.3 `updateRoleInputFields` メソッドを修正
  - [x] 4.3.1 フィールド削除時に即座にDOMから削除

### 5. AppController の修正

- [x] 5.1 `handleRouletteExecution` メソッドを修正
  - [x] 5.1.1 結果を先に保存
  - [x] 5.1.2 `availableMembers` と `selected` を `animateRoulette` に渡す

### 6. Discord Bot の修正

- [x] 6.1 `server/index.js` のURL生成を修正
  - [x] 6.1.1 `api_url` パラメータを削除
  - [x] 6.1.2 フロントエンドのURLとトークンのみを含む

### 7. GitHub Actions ワークフローの作成

- [x] 7.1 `.github/workflows/deploy.yml` を作成
  - [x] 7.1.1 ビルドジョブを追加
  - [x] 7.1.2 デプロイジョブを追加
  - [x] 7.1.3 環境変数の注入を設定

### 8. ドキュメントの更新

- [x] 8.1 `README.md` を更新
  - [x] 8.1.1 セットアップ手順を更新
  - [x] 8.1.2 デプロイ手順を更新
- [x] 8.2 `SETUP.md` を作成
  - [x] 8.2.1 詳細なセットアップガイドを記述
  - [x] 8.2.2 トラブルシューティングを追加

### 9. テストとデプロイ

- [x] 9.1 ローカルでビルドをテスト（`npm run build`）
- [x] 9.2 変更をコミット＆プッシュ
- [x] 9.3 GitHub Secretsを設定
  - [x] 9.3.1 `VITE_API_URL` を追加
- [x] 9.4 GitHub Pagesの設定を変更
  - [x] 9.4.1 Source を「GitHub Actions」に変更
- [x] 9.5 GitHub Actionsの実行を確認
- [x] 9.6 デプロイされたアプリケーションを確認

### 10. Render環境変数の更新

- [x] 10.1 Render Dashboardで `FRONTEND_URL` を更新
  - [x] 10.1.1 `https://yt-glaceon.github.io/roulette` に変更

## 完了条件

- すべてのタスクが完了している
- ローカルでビルドが成功する
- GitHub Actionsでビルド＆デプロイが成功する
- デプロイされたアプリケーションが正常に動作する
- CSSとJSが正しく読み込まれる
- ルーレットアニメーションと結果画面のメンバーが一致する
- 環境変数からAPI URLが取得される
- Discord BotがRenderのURLを含まないURLを生成する

## 注意事項

- `.env` ファイルはコミットしない
- GitHub Secretsは慎重に管理する
- ベースパスはリポジトリ名と一致させる
- Render環境変数の更新を忘れない
