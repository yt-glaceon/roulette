# 要件定義書：アニメーション修正と環境変数管理

## はじめに

本ドキュメントは、Discord ボイスルーレットアプリケーションのバグ修正と環境変数管理の改善に関する要件を定義します。

## 用語集

- **Vite**: モダンなフロントエンドビルドツール
- **環境変数**: ビルド時に注入される設定値
- **GitHub Actions**: CI/CDワークフロー自動化ツール
- **ベースパス**: GitHub Pagesでのリポジトリ名を含むパス

## 要件

### 要件 1: ルーレットアニメーションと結果画面の一致

**ユーザーストーリー:** ユーザーとして、ルーレットアニメーションで表示されるメンバーと結果画面のメンバーが一致してほしい。なぜなら、異なるメンバーが表示されると混乱するため。

#### 受入基準

1. WHEN ルーレットが開始されたとき、THE System SHALL 開始時に選出されたメンバーを保存する
2. WHEN ルーレットアニメーションが実行されるとき、THE RouletteWheel SHALL 除外者を除く全メンバーを円グラフに表示する
3. WHEN ルーレットの針が停止するとき、THE RouletteWheel SHALL 開始時に選出されたメンバーを順に指す
4. WHEN 結果画面が表示されるとき、THE UIController SHALL 開始時に選出されたメンバーを表示する
5. WHEN アニメーションが完了したとき、THE System SHALL 1秒待ってから結果ボタンを表示する

### 要件 2: 環境変数によるAPI URL管理

**ユーザーストーリー:** 開発者として、API URLをコードにハードコードせず環境変数で管理したい。なぜなら、セキュリティとメンテナンス性を向上させるため。

#### 受入基準

1. WHEN アプリケーションがビルドされるとき、THE System SHALL 環境変数からAPI URLを取得する
2. WHEN 開発環境で実行するとき、THE System SHALL `.env` ファイルから環境変数を読み込む
3. WHEN 本番環境でビルドするとき、THE System SHALL GitHub Secretsから環境変数を注入する
4. WHEN Discord BotがURLを生成するとき、THE Bot SHALL API URLをURLパラメータに含めない
5. WHEN フロントエンドがAPIにアクセスするとき、THE System SHALL ビルド時に注入された環境変数を使用する

### 要件 3: Viteビルドシステムの導入

**ユーザーストーリー:** 開発者として、モダンなビルドツールを使用したい。なぜなら、開発体験と本番環境のパフォーマンスを向上させるため。

#### 受入基準

1. WHEN 開発サーバーを起動するとき、THE System SHALL Viteの開発サーバーを使用する
2. WHEN 本番ビルドを実行するとき、THE System SHALL 最適化されたファイルを生成する
3. WHEN GitHub Pagesにデプロイするとき、THE System SHALL 正しいベースパスを設定する
4. WHEN CSSとJSファイルが読み込まれるとき、THE System SHALL ハッシュ付きファイル名を使用する
5. WHEN ビルドが完了したとき、THE System SHALL `dist/` ディレクトリに成果物を出力する

### 要件 4: UI/UXバグの修正

**ユーザーストーリー:** ユーザーとして、UIが正しく動作してほしい。なぜなら、バグがあると使いにくいため。

#### 受入基準

1. WHEN 選出人数を減少させたとき、THE UIController SHALL ロール入力フィールドを即座に削除する
2. WHEN アニメーション画面が表示されたとき、THE UIController SHALL ロール入力フィールドを非表示にする
3. WHEN ルーレット画面に戻ったとき、THE UIController SHALL ロール入力フィールドを再表示する
4. WHEN アニメーションが実行されるとき、THE UIController SHALL メンバーリストとコントロールを非表示にする

### 要件 5: GitHub Actions自動デプロイ

**ユーザーストーリー:** 開発者として、コミット時に自動的にデプロイされてほしい。なぜなら、手動デプロイは手間がかかるため。

#### 受入基準

1. WHEN mainブランチにプッシュされたとき、THE GitHub Actions SHALL 自動的にビルドを実行する
2. WHEN ビルドが成功したとき、THE GitHub Actions SHALL GitHub Pagesにデプロイする
3. WHEN ビルド中、THE GitHub Actions SHALL 環境変数を注入する
4. WHEN デプロイが完了したとき、THE System SHALL 新しいバージョンを公開する
5. WHEN ビルドが失敗したとき、THE GitHub Actions SHALL エラーメッセージを表示する
