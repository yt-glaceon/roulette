# 要件定義書

## はじめに

Discord Voice Rouletteアプリケーションにおいて、ユーザーがボイスチャネルを選択する際に、各チャネルに現在何人のメンバーがいるかを視覚的に表示する機能を追加します。これにより、ユーザーは人数情報を基にどのチャネルを選ぶべきか判断しやすくなり、ユーザー体験が向上します。

## 用語集

- **System**: Discord Voice Rouletteアプリケーション全体
- **UI_Controller**: ユーザーインターフェースの表示と更新を担当するフロントエンドコンポーネント
- **Discord_Client**: Discord APIとの通信を担当するフロントエンドコンポーネント
- **Backend_Server**: Discord Botを通じてDiscord APIからデータを取得するバックエンドサーバー
- **Voice_Channel**: Discordのボイスチャネル
- **Member_Count**: ボイスチャネルに現在接続しているメンバーの人数
- **Channel_Card**: チャネル選択画面に表示される各チャネルのカード型UI要素
- **Channel_List**: ボイスチャネルの一覧情報

## 要件

### 要件1: ボイスチャネルメンバー数の取得

**ユーザーストーリー:** 開発者として、各ボイスチャネルのメンバー数を取得できるようにしたい。これにより、UIに人数情報を表示できるようになる。

#### 受入基準

1. WHEN Backend_ServerがDiscord Botを通じてチャネル一覧を取得する時、THE Backend_Server SHALL 各Voice_Channelに接続しているメンバーの数を含めて返す
2. THE Backend_Server SHALL チャネル情報のレスポンスに`memberCount`フィールドを追加する
3. WHEN Voice_Channelにメンバーが存在しない時、THE Backend_Server SHALL `memberCount`を0として返す
4. THE Backend_Server SHALL 既存のチャネル情報（id、name、position）を保持したまま、memberCount情報を追加する

### 要件2: チャネルカードへのメンバー数表示

**ユーザーストーリー:** ユーザーとして、チャネル選択画面で各チャネルに何人いるかを一目で確認したい。これにより、適切なチャネルを素早く選択できる。

#### 受入基準

1. WHEN UI_Controllerがチャネル選択画面を表示する時、THE UI_Controller SHALL 各Channel_Cardにメンバー数を表示する
2. THE UI_Controller SHALL メンバー数を「👤 N人」の形式で表示する（Nはメンバー数）
3. WHEN Member_Countが0の時、THE UI_Controller SHALL 「👤 0人」と表示する
4. THE UI_Controller SHALL メンバー数表示をチャネル名の下または横に配置する
5. THE UI_Controller SHALL メンバー数表示を視覚的に識別しやすいスタイルで表示する

### 要件3: メンバー数情報の更新

**ユーザーストーリー:** ユーザーとして、チャネル選択画面を表示した時点での最新のメンバー数を見たい。これにより、正確な情報に基づいてチャネルを選択できる。

#### 受入基準

1. WHEN ユーザーがチャネル選択画面を表示する時、THE System SHALL 最新のメンバー数情報を取得する
2. THE Discord_Client SHALL `/api/guild/channels`エンドポイントからメンバー数を含むチャネル情報を取得する
3. WHEN チャネル情報の取得に失敗した時、THE System SHALL エラーメッセージを表示し、メンバー数を表示しない

### 要件4: 既存機能との互換性

**ユーザーストーリー:** 開発者として、既存のチャネル選択機能が正常に動作し続けることを確認したい。これにより、新機能追加による不具合を防ぐ。

#### 受入基準

1. THE System SHALL 既存のチャネル選択機能（チャネルのクリック、選択後のメンバー一覧表示）を保持する
2. THE System SHALL チャネルカードの既存のレイアウト（アイコン、チャネル名）を維持する
3. WHEN メンバー数情報が取得できない時、THE System SHALL チャネル選択機能を引き続き利用可能にする

### 要件5: パフォーマンスとユーザー体験

**ユーザーストーリー:** ユーザーとして、メンバー数表示機能によってアプリケーションの応答速度が低下しないことを期待する。

#### 受入基準

1. THE Backend_Server SHALL チャネル一覧取得時に追加のAPI呼び出しを行わずにメンバー数を取得する
2. WHEN チャネル一覧を取得する時、THE Backend_Server SHALL 500ミリ秒以内にレスポンスを返す
3. THE UI_Controller SHALL メンバー数の表示によってチャネルカードのレンダリング時間が50ミリ秒以上増加しないようにする
