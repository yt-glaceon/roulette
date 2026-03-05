# 技術設計書: ボイスチャネルメンバー数表示機能

## 概要

Discord Voice Rouletteアプリケーションに、ボイスチャネル選択画面で各チャネルの現在のメンバー数を表示する機能を追加します。この機能により、ユーザーは各チャネルの人数を確認してから選択できるようになり、ユーザー体験が向上します。

### 目的

- ユーザーがチャネル選択時に各チャネルのメンバー数を視覚的に確認できるようにする
- 既存のチャネル選択機能を維持しながら、追加情報を提供する
- パフォーマンスへの影響を最小限に抑える

### スコープ

**含まれるもの:**
- バックエンドAPIでのメンバー数取得機能の追加
- フロントエンドUIでのメンバー数表示機能の追加
- エラーハンドリングの実装

**含まれないもの:**
- リアルタイムでのメンバー数更新（画面表示時のみ取得）
- メンバー数に基づくフィルタリング機能
- メンバー数の履歴追跡

## アーキテクチャ

### システム構成

```
┌─────────────────┐
│  フロントエンド  │
│  (Vite + JS)    │
└────────┬────────┘
         │ HTTP Request
         │ GET /api/guild/channels?token=xxx
         ↓
┌─────────────────┐
│  バックエンド    │
│  (Express.js)   │
└────────┬────────┘
         │ Discord.js API
         ↓
┌─────────────────┐
│  Discord API    │
│  (Bot)          │
└─────────────────┘
```

### データフロー

1. **チャネル一覧取得時:**
   ```
   ユーザー操作
     → UIController.showChannelSelection()
     → DiscordClient.getChannels()
     → Backend: GET /api/guild/channels
     → Discord.js: guild.channels.cache + channel.members
     → レスポンス: [{id, name, position, memberCount}, ...]
     → UIController: チャネルカード生成（メンバー数表示含む）
   ```

2. **エラー発生時:**
   ```
   API呼び出し失敗
     → DiscordClient: エラーをキャッチ
     → UIController.showError()
     → ユーザーにエラーメッセージ表示
   ```

### レイヤー構成

| レイヤー | 責務 | 主要コンポーネント |
|---------|------|------------------|
| プレゼンテーション層 | UI表示、ユーザー操作 | UIController, HTML/CSS |
| アプリケーション層 | ビジネスロジック、状態管理 | AppController |
| データアクセス層 | API通信 | DiscordClient |
| バックエンド層 | Discord API連携 | Express Server, Discord.js |

## コンポーネントとインターフェース

### 1. バックエンド: `/api/guild/channels` エンドポイント

**ファイル:** `server/index.js`

**変更内容:**
既存のエンドポイントを拡張し、各チャネルに`memberCount`フィールドを追加します。

**実装方法:**
```javascript
// 既存コード（変更前）
const voiceChannels = guild.channels.cache
  .filter(channel => channel.type === 2)
  .map(channel => ({
    id: channel.id,
    name: channel.name,
    position: channel.position,
  }))
  .sort((a, b) => a.position - b.position);

// 新しいコード（変更後）
const voiceChannels = guild.channels.cache
  .filter(channel => channel.type === 2)
  .map(channel => ({
    id: channel.id,
    name: channel.name,
    position: channel.position,
    memberCount: channel.members.size  // 追加
  }))
  .sort((a, b) => a.position - b.position);
```

**インターフェース:**

```typescript
// リクエスト
GET /api/guild/channels?token={accessToken}

// レスポンス（成功時）
[
  {
    id: string,          // チャネルID
    name: string,        // チャネル名
    position: number,    // 表示順序
    memberCount: number  // メンバー数（新規追加）
  },
  ...
]

// レスポンス（エラー時）
{
  error: string  // エラーメッセージ
}
```

**エラーハンドリング:**
- 既存のエラーハンドリング機構を使用
- トークン検証エラー: 401
- ギルド未検出: 404
- サーバーエラー: 500

### 2. フロントエンド: UIController

**ファイル:** `js/ui-controller.js`

**変更内容:**
`createChannelCard()`メソッドを拡張し、メンバー数表示要素を追加します。

**実装方法:**
```javascript
createChannelCard(channel) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.channelId = channel.id;

    const icon = document.createElement('div');
    icon.className = 'card-icon';
    icon.textContent = '🔊';

    const content = document.createElement('div');
    content.className = 'card-content';
    
    const name = document.createElement('h3');
    name.textContent = channel.name;
    
    // メンバー数表示を追加（新規）
    const memberCount = document.createElement('div');
    memberCount.className = 'channel-member-count';
    memberCount.textContent = `👤 ${channel.memberCount}人`;
    
    content.appendChild(name);
    content.appendChild(memberCount);  // 追加
    card.appendChild(icon);
    card.appendChild(content);

    return card;
}
```

**DOM構造:**
```html
<div class="card" data-channel-id="...">
  <div class="card-icon">🔊</div>
  <div class="card-content">
    <h3>チャネル名</h3>
    <div class="channel-member-count">👤 3人</div>  <!-- 新規追加 -->
  </div>
</div>
```

### 3. フロントエンド: スタイル

**ファイル:** `css/style.css`

**追加内容:**
メンバー数表示用のスタイルを追加します。

```css
.channel-member-count {
    font-size: 0.9rem;
    color: #888;
    margin-top: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}
```

**デザイン方針:**
- チャネル名の下に配置
- 控えめな色（グレー系）で表示
- アイコン（👤）と数値を並べて表示
- 既存のカードデザインとの調和を保つ

## データモデル

### Channel（拡張）

```typescript
interface Channel {
  id: string;          // チャネルID（既存）
  name: string;        // チャネル名（既存）
  position: number;    // 表示順序（既存）
  memberCount: number; // メンバー数（新規追加）
}
```

**制約:**
- `memberCount`は0以上の整数
- `memberCount`はチャネル取得時点のスナップショット（リアルタイム更新なし）

### Discord.js VoiceChannel

Discord.jsの`VoiceChannel`オブジェクトから以下のプロパティを使用:

```typescript
channel.members: Collection<Snowflake, GuildMember>
channel.members.size: number  // メンバー数
```

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において真であるべき特性や動作のことです。これは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなる形式的な記述です。*

### Property 1: チャネル情報にmemberCountフィールドが含まれる

*任意の*ボイスチャネル一覧取得リクエストに対して、レスポンスの各チャネルオブジェクトは`memberCount`フィールドを含み、その値は0以上の整数である

**検証: 要件 1.1, 1.2, 1.3**

### Property 2: 既存フィールドが保持される

*任意の*チャネルに対して、`memberCount`フィールドを追加した後も、既存のフィールド（`id`, `name`, `position`）がすべて保持され、値が変更されない

**検証: 要件 1.4, 4.2**

### Property 3: メンバー数が正しいフォーマットで表示される

*任意の*メンバー数（0を含む）に対して、UIに表示される文字列は「👤 N人」の形式である（Nはメンバー数）

**検証: 要件 2.2, 2.3**

### Property 4: チャネルカードにメンバー数表示要素が含まれる

*任意の*チャネルデータに対して、生成されるチャネルカードのDOM要素は`channel-member-count`クラスを持つ子要素を含む

**検証: 要件 2.1**

### Property 5: エラー時の適切な処理

*任意の*APIエラー（ネットワークエラー、認証エラー、サーバーエラー）に対して、システムはエラーメッセージを表示し、アプリケーションがクラッシュしない

**検証: 要件 3.3, 4.3**

## エラーハンドリング

### バックエンド

| エラー条件 | HTTPステータス | レスポンス | 対応 |
|-----------|--------------|-----------|------|
| トークン未提供 | 401 | `{error: "アクセストークンが必要です"}` | 既存の処理を使用 |
| トークン無効 | 401 | `{error: "無効なトークンです"}` | 既存の処理を使用 |
| ギルド未検出 | 404 | `{error: "Guild not found"}` | 既存の処理を使用 |
| Discord API エラー | 500 | `{error: "Failed to fetch channels"}` | 既存の処理を使用 |

**実装上の注意:**
- `channel.members`へのアクセスは安全（Discord.jsが保証）
- `channel.members.size`は常に0以上の整数を返す
- 追加のエラーハンドリングは不要（既存の機構で十分）

### フロントエンド

| エラー条件 | 表示内容 | ユーザー操作 |
|-----------|---------|------------|
| API呼び出し失敗 | エラーメッセージ表示 | 再読み込みを促す |
| `memberCount`フィールド欠落 | デフォルト値（0）を使用 | 通常通り動作 |
| ネットワークエラー | 「ネットワークエラーが発生しました」 | 再読み込みを促す |

**実装方針:**
```javascript
// DiscordClient.getChannels() でのエラーハンドリング（既存）
try {
    const channels = await this.discordClient.getChannels();
    this.uiController.showChannelSelection(channels, guildName);
} catch (error) {
    this.uiController.showError(error.message || 'チャネル情報の取得に失敗しました');
}

// createChannelCard() でのフォールバック（新規）
const memberCount = document.createElement('div');
memberCount.className = 'channel-member-count';
memberCount.textContent = `👤 ${channel.memberCount ?? 0}人`;  // null/undefinedの場合は0
```

## テスト戦略

### デュアルテストアプローチ

この機能では、ユニットテストとプロパティベーステストの両方を使用して包括的なカバレッジを実現します:

- **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- **プロパティテスト**: すべての入力に対する普遍的なプロパティを検証

両者は補完的であり、包括的なカバレッジに必要です。ユニットテストは具体的なバグを捕捉し、プロパティテストはランダム化による広範な入力カバレッジを提供します。

### プロパティベーステスト

**使用ライブラリ:** fast-check（JavaScript用プロパティベーステストライブラリ）

**設定:**
- 各プロパティテストは最低100回の反復を実行
- 各テストは設計ドキュメントのプロパティを参照
- タグ形式: **Feature: voice-channel-member-count, Property {番号}: {プロパティテキスト}**

**テストケース:**

#### 1. バックエンド: チャネル情報にmemberCountが含まれる

```javascript
// Feature: voice-channel-member-count, Property 1: チャネル情報にmemberCountフィールドが含まれる
test('任意のチャネル一覧に対してmemberCountフィールドが含まれる', () => {
  fc.assert(
    fc.property(
      fc.array(channelGenerator()),  // ランダムなチャネル配列を生成
      (channels) => {
        const response = getChannelsResponse(channels);
        return response.every(ch => 
          typeof ch.memberCount === 'number' && 
          ch.memberCount >= 0 &&
          Number.isInteger(ch.memberCount)
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

#### 2. バックエンド: 既存フィールドが保持される

```javascript
// Feature: voice-channel-member-count, Property 2: 既存フィールドが保持される
test('任意のチャネルに対して既存フィールドが保持される', () => {
  fc.assert(
    fc.property(
      channelGenerator(),
      (originalChannel) => {
        const response = transformChannel(originalChannel);
        return (
          response.id === originalChannel.id &&
          response.name === originalChannel.name &&
          response.position === originalChannel.position
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

#### 3. フロントエンド: メンバー数が正しいフォーマットで表示される

```javascript
// Feature: voice-channel-member-count, Property 3: メンバー数が正しいフォーマットで表示される
test('任意のメンバー数に対して正しいフォーマットで表示される', () => {
  fc.assert(
    fc.property(
      fc.nat(100),  // 0から100までの自然数
      (memberCount) => {
        const channel = { id: '1', name: 'test', position: 0, memberCount };
        const card = uiController.createChannelCard(channel);
        const countElement = card.querySelector('.channel-member-count');
        return countElement.textContent === `👤 ${memberCount}人`;
      }
    ),
    { numRuns: 100 }
  );
});
```

#### 4. フロントエンド: チャネルカードにメンバー数表示要素が含まれる

```javascript
// Feature: voice-channel-member-count, Property 4: チャネルカードにメンバー数表示要素が含まれる
test('任意のチャネルデータに対してメンバー数表示要素が含まれる', () => {
  fc.assert(
    fc.property(
      channelWithMemberCountGenerator(),
      (channel) => {
        const card = uiController.createChannelCard(channel);
        const countElement = card.querySelector('.channel-member-count');
        return countElement !== null && countElement.classList.contains('channel-member-count');
      }
    ),
    { numRuns: 100 }
  );
});
```

#### 5. エラーハンドリング: エラー時の適切な処理

```javascript
// Feature: voice-channel-member-count, Property 5: エラー時の適切な処理
test('任意のAPIエラーに対して適切に処理される', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.constant({ type: 'NETWORK_ERROR', message: 'ネットワークエラー' }),
        fc.constant({ type: 'AUTH_ERROR', status: 401, message: '認証エラー' }),
        fc.constant({ type: 'SERVER_ERROR', status: 500, message: 'サーバーエラー' })
      ),
      async (error) => {
        try {
          await discordClient.getChannels();
          return false;  // エラーが投げられるべき
        } catch (e) {
          // アプリケーションがクラッシュせず、エラーメッセージが設定される
          return e.message && typeof e.message === 'string';
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### ユニットテスト

ユニットテストは特定の例とエッジケースに焦点を当てます。プロパティテストが多くの入力をカバーするため、ユニットテストは最小限に抑えます。

**テストケース:**

#### バックエンド

```javascript
describe('GET /api/guild/channels', () => {
  test('メンバーが3人いるチャネルでmemberCountが3を返す', async () => {
    // 特定の例
    const response = await request(app)
      .get('/api/guild/channels?token=valid_token');
    expect(response.body[0].memberCount).toBe(3);
  });

  test('空のチャネルでmemberCountが0を返す', async () => {
    // エッジケース
    const response = await request(app)
      .get('/api/guild/channels?token=empty_channel_token');
    expect(response.body[0].memberCount).toBe(0);
  });
});
```

#### フロントエンド

```javascript
describe('UIController.createChannelCard', () => {
  test('チャネル選択画面が表示される時にAPIが呼ばれる', async () => {
    // 統合ポイント
    const spy = jest.spyOn(discordClient, 'getChannels');
    await appController.showChannelSelection();
    expect(spy).toHaveBeenCalled();
  });

  test('メンバー数表示がチャネル名の下に配置される', () => {
    // レイアウト確認
    const channel = { id: '1', name: 'test', position: 0, memberCount: 5 };
    const card = uiController.createChannelCard(channel);
    const content = card.querySelector('.card-content');
    const children = Array.from(content.children);
    const nameIndex = children.findIndex(el => el.tagName === 'H3');
    const countIndex = children.findIndex(el => el.classList.contains('channel-member-count'));
    expect(countIndex).toBeGreaterThan(nameIndex);
  });

  test('memberCountがundefinedの場合に0を表示する', () => {
    // エラー時のフォールバック
    const channel = { id: '1', name: 'test', position: 0 };
    const card = uiController.createChannelCard(channel);
    const countElement = card.querySelector('.channel-member-count');
    expect(countElement.textContent).toBe('👤 0人');
  });

  test('既存のチャネル選択機能が動作する', async () => {
    // 回帰テスト
    const channel = { id: '1', name: 'test', position: 0, memberCount: 5 };
    const card = uiController.createChannelCard(channel);
    card.click();
    // 既存のクリックハンドラが動作することを確認
    expect(card.dataset.channelId).toBe('1');
  });
});
```

### テスト実行

```bash
# すべてのテストを実行
npm test

# プロパティテストのみ実行
npm test -- --testNamePattern="Property"

# カバレッジレポート生成
npm test -- --coverage
```

### テストカバレッジ目標

- 行カバレッジ: 90%以上
- 分岐カバレッジ: 85%以上
- 関数カバレッジ: 95%以上

## 実装計画

### フェーズ1: バックエンド実装

1. `server/index.js`の`/api/guild/channels`エンドポイントを修正
2. バックエンドのユニットテストを作成
3. バックエンドのプロパティテストを作成
4. 手動テスト（Postmanなど）で動作確認

### フェーズ2: フロントエンド実装

1. `js/ui-controller.js`の`createChannelCard()`メソッドを修正
2. `css/style.css`にスタイルを追加
3. フロントエンドのユニットテストを作成
4. フロントエンドのプロパティテストを作成

### フェーズ3: 統合テストと検証

1. 統合テストを実行
2. 手動テスト（ブラウザ）で動作確認
3. エラーケースの検証
4. パフォーマンステスト

### フェーズ4: ドキュメント更新とデプロイ

1. README.mdの更新（必要に応じて）
2. コードレビュー
3. デプロイ

## パフォーマンス考慮事項

### バックエンド

**現在の実装:**
```javascript
channel.members.size  // O(1) - Collectionのsizeプロパティ
```

- `channel.members`はDiscord.jsがキャッシュしているCollection
- `.size`プロパティはO(1)で取得可能
- 追加のAPI呼び出しは不要
- パフォーマンスへの影響は無視できるレベル

**メモリ使用量:**
- 各チャネルに4バイト（number型）追加
- 100チャネルでも400バイト程度
- 影響は無視できるレベル

### フロントエンド

**DOM操作:**
```javascript
// 1チャネルあたり2つの追加DOM操作
const memberCount = document.createElement('div');  // 1回
content.appendChild(memberCount);                   // 1回
```

- 既存の実装と同様のパターン
- レンダリング時間への影響は最小限（<5ms/チャネル）
- 100チャネルでも500ms以下

**ネットワーク:**
- レスポンスサイズの増加: 約10-20バイト/チャネル
- 100チャネルで1-2KB増加
- 影響は無視できるレベル

## セキュリティ考慮事項

### 既存のセキュリティ機構を使用

- トークンベース認証（既存）
- CORS設定（既存）
- アクセス制御（既存）

### 新規追加による影響

- メンバー数は公開情報（Discordクライアントでも表示される）
- 個人情報は含まれない
- 追加のセキュリティ対策は不要

## 互換性

### 後方互換性

- 既存のAPIエンドポイントを拡張（フィールド追加のみ）
- 既存のフロントエンドコードは影響を受けない
- 既存のチャネル選択機能は変更なし

### 前方互換性

- `memberCount`フィールドが欠落している場合のフォールバック実装
- 将来的な拡張（リアルタイム更新など）を考慮した設計

## 依存関係

### 既存の依存関係

- Discord.js: `channel.members` APIを使用
- Express.js: 既存のエンドポイント拡張
- Vite: ビルドツール（変更なし）

### 新規の依存関係

- fast-check: プロパティベーステスト用（devDependency）

```bash
npm install --save-dev fast-check
```

## デプロイメント

### デプロイ手順

1. バックエンドのデプロイ
   ```bash
   cd server
   npm install
   npm test
   # デプロイコマンド（環境に応じて）
   ```

2. フロントエンドのビルドとデプロイ
   ```bash
   npm install
   npm test
   npm run build
   # dist/をデプロイ
   ```

### ロールバック計画

- バックエンド: 前バージョンに戻す
- フロントエンド: 前バージョンのdist/をデプロイ
- データベース変更なし（ロールバック不要）

### モニタリング

- バックエンドログで`/api/guild/channels`のレスポンスタイムを監視
- エラーレート（500エラー）を監視
- フロントエンドでのJavaScriptエラーを監視

## 今後の拡張可能性

### 短期的な拡張

- メンバー数に基づくソート機能
- メンバー数0のチャネルを非表示にするフィルター

### 長期的な拡張

- WebSocketを使用したリアルタイムメンバー数更新
- メンバー数の履歴グラフ表示
- メンバー数に基づくレコメンデーション機能

## 参考資料

- [Discord.js Documentation - VoiceChannel](https://discord.js.org/#/docs/discord.js/main/class/VoiceChannel)
- [Discord.js Documentation - Collection](https://discord.js.org/#/docs/collection/main/class/Collection)
- [fast-check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
