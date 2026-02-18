# 設計書

## 概要

Discord ボイスルーレットアプリケーションは、Discord API を利用してボイスチャネルのメンバー情報を取得し、指定人数をランダムに選出する完全クライアントサイドの Web アプリケーションです。GitHub Pages での静的ホスティングを前提とし、サーバーレスアーキテクチャを採用します。

### 技術スタック

- **フロントエンド**: HTML5、CSS3、JavaScript (ES6+)
- **UI フレームワーク**: なし（Vanilla JS）または軽量フレームワーク（検討中）
- **Discord 統合**: Discord OAuth2、Discord REST API
- **ホスティング**: GitHub Pages
- **ビルドツール**: なし（静的ファイルのみ）または軽量バンドラー（検討中）

## アーキテクチャ

### システム構成

```mermaid
graph TB
    User[ユーザー] -->|アクセス| GHP[GitHub Pages]
    GHP -->|静的ファイル配信| Browser[ブラウザ]
    Browser -->|OAuth2 認証| Discord[Discord API]
    Browser -->|メンバー情報取得| Discord
    Browser -->|ローカルストレージ| Storage[ブラウザストレージ]
```

### アーキテクチャの特徴

1. **完全クライアントサイド**: すべての処理がブラウザ内で完結
2. **サーバーレス**: バックエンドサーバー不要
3. **ステートレス**: サーバー側でのセッション管理なし
4. **セキュア**: トークンはブラウザのローカルストレージのみに保存

### データフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant B as ブラウザ
    participant D as Discord API
    participant S as ローカルストレージ

    U->>B: 認証ボタンクリック
    B->>D: OAuth2 認証リクエスト
    D->>B: 認証コード
    B->>D: トークン交換
    D->>B: アクセストークン
    B->>S: トークン保存
    
    U->>B: サーバー選択
    B->>D: ギルド情報取得
    D->>B: ギルドリスト
    
    U->>B: チャネル選択
    B->>D: ボイスチャネルメンバー取得
    D->>B: メンバーリスト
    
    U->>B: ルーレット実行
    B->>B: ランダム選出処理
    B->>U: 結果表示
```

## コンポーネントとインターフェース

### 1. 認証モジュール (AuthModule)

Discord OAuth2 認証フローを管理します。

#### 責務
- OAuth2 認証フローの開始
- 認証コードの受け取りとトークン交換
- アクセストークンの保存と管理
- ログアウト処理

#### インターフェース

```javascript
class AuthModule {
  /**
   * Discord OAuth2 認証を開始
   * @returns {Promise<void>}
   */
  async initiateAuth()

  /**
   * OAuth2 コールバックを処理
   * @param {string} code - 認証コード
   * @returns {Promise<string>} アクセストークン
   */
  async handleCallback(code)

  /**
   * 保存されたトークンを取得
   * @returns {string|null} アクセストークン
   */
  getToken()

  /**
   * 認証状態を確認
   * @returns {boolean} 認証済みかどうか
   */
  isAuthenticated()

  /**
   * ログアウト処理
   * @returns {void}
   */
  logout()
}
```

### 2. Discord API クライアント (DiscordClient)

Discord REST API との通信を担当します。

#### 責務
- Discord API へのリクエスト送信
- レート制限の処理
- エラーハンドリング
- レスポンスのパース

#### インターフェース

```javascript
class DiscordClient {
  /**
   * コンストラクタ
   * @param {string} token - アクセストークン
   */
  constructor(token)

  /**
   * ユーザーがアクセス可能なギルドを取得
   * @returns {Promise<Guild[]>} ギルドリスト
   */
  async getGuilds()

  /**
   * 指定ギルドのチャネルリストを取得
   * @param {string} guildId - ギルド ID
   * @returns {Promise<Channel[]>} チャネルリスト
   */
  async getChannels(guildId)

  /**
   * 指定ボイスチャネルのメンバーリストを取得
   * @param {string} guildId - ギルド ID
   * @param {string} channelId - チャネル ID
   * @returns {Promise<Member[]>} メンバーリスト
   */
  async getVoiceChannelMembers(guildId, channelId)

  /**
   * API リクエストを実行
   * @param {string} endpoint - API エンドポイント
   * @param {Object} options - リクエストオプション
   * @returns {Promise<Object>} レスポンス
   */
  async request(endpoint, options)
}
```

### 3. ルーレットエンジン (RouletteEngine)

メンバーのランダム選出ロジックを実装します。

#### 責務
- メンバーリストからのランダム選出
- 選出人数のバリデーション
- 公平性の保証（均等確率）

#### インターフェース

```javascript
class RouletteEngine {
  /**
   * メンバーリストから指定人数をランダムに選出
   * @param {Member[]} members - メンバーリスト
   * @param {number} count - 選出人数
   * @returns {Member[]} 選出されたメンバー
   * @throws {Error} 無効な選出人数の場合
   */
  selectMembers(members, count)

  /**
   * 選出人数のバリデーション
   * @param {number} count - 選出人数
   * @param {number} totalMembers - 総メンバー数
   * @returns {boolean} 有効かどうか
   */
  validateCount(count, totalMembers)

  /**
   * Fisher-Yates シャッフルアルゴリズム
   * @param {Array} array - シャッフル対象の配列
   * @returns {Array} シャッフルされた配列
   */
  shuffle(array)
}
```

### 4. UI コントローラー (UIController)

ユーザーインターフェースの状態管理と更新を担当します。

#### 責務
- UI の状態管理
- ユーザー入力の処理
- 画面遷移の制御
- アニメーション効果の管理

#### インターフェース

```javascript
class UIController {
  /**
   * 認証画面を表示
   * @returns {void}
   */
  showAuthScreen()

  /**
   * ギルド選択画面を表示
   * @param {Guild[]} guilds - ギルドリスト
   * @returns {void}
   */
  showGuildSelection(guilds)

  /**
   * チャネル選択画面を表示
   * @param {Channel[]} channels - チャネルリスト
   * @returns {void}
   */
  showChannelSelection(channels)

  /**
   * メンバーリストとルーレット画面を表示
   * @param {Member[]} members - メンバーリスト
   * @returns {void}
   */
  showRouletteScreen(members)

  /**
   * ルーレット結果を表示
   * @param {Member[]} selectedMembers - 選出されたメンバー
   * @returns {void}
   */
  showResults(selectedMembers)

  /**
   * ローディング表示
   * @param {boolean} show - 表示するかどうか
   * @returns {void}
   */
  showLoading(show)

  /**
   * エラーメッセージを表示
   * @param {string} message - エラーメッセージ
   * @returns {void}
   */
  showError(message)

  /**
   * ルーレットアニメーションを実行
   * @param {Member[]} members - 全メンバー
   * @param {Member[]} selected - 選出されたメンバー
   * @returns {Promise<void>}
   */
  async animateRoulette(members, selected)
}
```

### 5. アプリケーションコントローラー (AppController)

アプリケーション全体のフローを制御します。

#### 責務
- 各モジュールの初期化と連携
- アプリケーションフローの管理
- イベントハンドリング

#### インターフェース

```javascript
class AppController {
  /**
   * コンストラクタ
   */
  constructor()

  /**
   * アプリケーションを初期化
   * @returns {Promise<void>}
   */
  async initialize()

  /**
   * 認証フローを開始
   * @returns {Promise<void>}
   */
  async startAuth()

  /**
   * ギルド選択を処理
   * @param {string} guildId - 選択されたギルド ID
   * @returns {Promise<void>}
   */
  async handleGuildSelection(guildId)

  /**
   * チャネル選択を処理
   * @param {string} channelId - 選択されたチャネル ID
   * @returns {Promise<void>}
   */
  async handleChannelSelection(channelId)

  /**
   * ルーレット実行を処理
   * @param {number} count - 選出人数
   * @returns {Promise<void>}
   */
  async handleRouletteExecution(count)

  /**
   * ログアウトを処理
   * @returns {void}
   */
  handleLogout()
}
```

## データモデル

### Guild（ギルド）

```javascript
{
  id: string,           // ギルド ID
  name: string,         // ギルド名
  icon: string | null   // アイコン URL
}
```

### Channel（チャネル）

```javascript
{
  id: string,           // チャネル ID
  name: string,         // チャネル名
  type: number,         // チャネルタイプ（2 = ボイス）
  guildId: string       // 所属ギルド ID
}
```

### Member（メンバー）

```javascript
{
  id: string,           // ユーザー ID
  username: string,     // ユーザー名
  discriminator: string,// ディスクリミネーター
  avatar: string | null,// アバター URL
  displayName: string   // 表示名（ニックネームまたはユーザー名）
}
```

### RouletteResult（ルーレット結果）

```javascript
{
  timestamp: number,        // 実行時刻（Unix タイムスタンプ）
  guildId: string,          // ギルド ID
  channelId: string,        // チャネル ID
  totalMembers: number,     // 総メンバー数
  selectedCount: number,    // 選出人数
  selectedMembers: Member[] // 選出されたメンバー
}
```

## 正確性プロパティ

プロパティとは、システムのすべての有効な実行において真であるべき特性や振る舞いのことです。これは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。


### プロパティ 1: 認証成功時のトークン保存

*任意の*有効な Discord 認証レスポンスに対して、システムはアクセストークンをローカルストレージに保存し、そのトークンを使用してギルドリストを取得できる

**検証: 要件 1.2, 1.3, 7.1**

### プロパティ 2: サーバー選択時のチャネルリスト取得

*任意の*有効なギルド ID に対して、システムはそのギルドに属するボイスチャネルのリストを取得し、表示する

**検証: 要件 1.4**

### プロパティ 3: チャネル選択時のメンバーリスト取得

*任意の*有効なチャネル ID に対して、システムはそのチャネルに参加している全メンバーのリストを取得し、各メンバーの表示名とアバター画像を含めて表示する

**検証: 要件 2.1, 2.2**

### プロパティ 4: 選出人数のバリデーション

*任意の*入力値に対して、システムは 1 以上かつメンバー総数以下の整数値のみを有効とし、範囲外の値は拒否してエラーメッセージを表示する

**検証: 要件 3.1, 3.2**

### プロパティ 5: ルーレット選出の正確性

*任意の*メンバーリストと有効な選出人数に対して、システムは正確に指定された人数のメンバーを選出し、重複なく返す

**検証: 要件 3.3**

### プロパティ 6: 選出確率の均等性

*任意の*メンバーリストに対して、十分な回数のルーレット実行を行った場合、各メンバーが選出される確率は統計的に均等である

**検証: 要件 3.4**

### プロパティ 7: 結果表示の完全性

*任意の*ルーレット結果に対して、システムは選出されたすべてのメンバーの表示名、アバター画像、選出順序を含めて表示する

**検証: 要件 4.1, 4.2**

### プロパティ 8: クリップボードコピー機能

*任意の*ルーレット結果に対して、コピー機能を実行すると、選出されたメンバー名がテキスト形式でクリップボードに正しくコピーされる

**検証: 要件 4.4**

### プロパティ 9: 履歴保存と取得

*任意の*ルーレット実行結果は履歴として保存され、後から取得して表示できる

**検証: 要件 4.5**

### プロパティ 10: API エラーハンドリング

*任意の*API 呼び出しエラー（ネットワークエラー、認証エラー、レート制限など）に対して、システムは適切なエラーメッセージを表示し、再試行オプションを提供する

**検証: 要件 1.5, 2.4, 8.1, 8.2**

### プロパティ 11: レート制限処理

*任意の*レート制限エラーに対して、システムは待機時間を表示し、適切な待機後に自動的に再試行する

**検証: 要件 8.3**

### プロパティ 12: ログアウト時の認証情報削除

*任意の*認証済み状態からログアウトを実行すると、システムはローカルストレージから全ての認証情報を削除し、認証前の状態に戻る

**検証: 要件 7.3**

### プロパティ 13: ユーザーフィードバックの提供

*任意の*ユーザー操作（ボタンクリック、データ取得など）に対して、システムは適切なフィードバック（ローディング表示、成功メッセージ、エラーメッセージ）を提供する

**検証: 要件 6.2**

## エラーハンドリング

### エラーの分類

1. **認証エラー**
   - OAuth2 認証失敗
   - トークンの有効期限切れ
   - 権限不足

2. **API エラー**
   - ネットワークエラー
   - レート制限
   - 無効なリクエスト
   - サーバーエラー（5xx）

3. **バリデーションエラー**
   - 無効な選出人数
   - 空のメンバーリスト

4. **クライアントエラー**
   - ローカルストレージアクセスエラー
   - クリップボードアクセスエラー

### エラーハンドリング戦略

#### 1. 認証エラー

```javascript
try {
  const token = await authModule.handleCallback(code);
} catch (error) {
  if (error.type === 'AUTH_FAILED') {
    uiController.showError('認証に失敗しました。もう一度お試しください。');
    uiController.showAuthScreen();
  } else if (error.type === 'TOKEN_EXPIRED') {
    uiController.showError('セッションの有効期限が切れました。再度ログインしてください。');
    authModule.logout();
    uiController.showAuthScreen();
  }
}
```

#### 2. API エラー

```javascript
try {
  const members = await discordClient.getVoiceChannelMembers(guildId, channelId);
} catch (error) {
  if (error.type === 'NETWORK_ERROR') {
    uiController.showError('ネットワークエラーが発生しました。', {
      retry: true,
      onRetry: () => this.handleChannelSelection(channelId)
    });
  } else if (error.type === 'RATE_LIMIT') {
    const waitTime = error.retryAfter;
    uiController.showError(`レート制限に達しました。${waitTime}秒後に自動的に再試行します。`);
    setTimeout(() => this.handleChannelSelection(channelId), waitTime * 1000);
  } else if (error.status === 403) {
    uiController.showError('このチャネルにアクセスする権限がありません。');
  } else {
    uiController.showError('データの取得に失敗しました。もう一度お試しください。');
  }
}
```

#### 3. バリデーションエラー

```javascript
try {
  const selected = rouletteEngine.selectMembers(members, count);
} catch (error) {
  if (error.type === 'INVALID_COUNT') {
    uiController.showError(`選出人数は 1 以上 ${members.length} 以下で指定してください。`);
  } else if (error.type === 'EMPTY_MEMBERS') {
    uiController.showError('メンバーがいません。別のチャネルを選択してください。');
  }
}
```

#### 4. クライアントエラー

```javascript
try {
  localStorage.setItem('discord_token', token);
} catch (error) {
  uiController.showError('データの保存に失敗しました。ブラウザの設定を確認してください。');
}

try {
  await navigator.clipboard.writeText(resultText);
  uiController.showSuccess('結果をクリップボードにコピーしました。');
} catch (error) {
  uiController.showError('クリップボードへのコピーに失敗しました。');
}
```

### エラーログ

開発環境では、すべてのエラーをコンソールに詳細ログとして出力します：

```javascript
console.error('[Discord Roulette Error]', {
  type: error.type,
  message: error.message,
  stack: error.stack,
  context: {
    guildId,
    channelId,
    timestamp: Date.now()
  }
});
```

## テスト戦略

### デュアルテストアプローチ

本プロジェクトでは、ユニットテストとプロパティベーステストの両方を使用して包括的なテストカバレッジを実現します。

- **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- **プロパティベーステスト**: すべての入力に対する普遍的なプロパティを検証

両者は補完的であり、ユニットテストは具体的なバグを捕捉し、プロパティテストは一般的な正確性を検証します。

### プロパティベーステスト

#### テストライブラリ

JavaScript 用のプロパティベーステストライブラリとして **fast-check** を使用します。

#### テスト設定

- 各プロパティテストは最低 100 回の反復を実行
- 各テストには設計書のプロパティ番号を参照するタグを付与
- タグ形式: `Feature: discord-voice-roulette, Property {番号}: {プロパティテキスト}`

#### プロパティテスト例

```javascript
import fc from 'fast-check';

// Feature: discord-voice-roulette, Property 5: ルーレット選出の正確性
test('任意のメンバーリストと有効な選出人数に対して、正確に指定された人数を選出', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        id: fc.string(),
        username: fc.string(),
        discriminator: fc.string(),
        avatar: fc.option(fc.string()),
        displayName: fc.string()
      }), { minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1 }),
      (members, count) => {
        fc.pre(count <= members.length); // 前提条件
        
        const engine = new RouletteEngine();
        const selected = engine.selectMembers(members, count);
        
        // 選出人数が正確
        expect(selected.length).toBe(count);
        
        // 重複なし
        const ids = selected.map(m => m.id);
        expect(new Set(ids).size).toBe(count);
        
        // すべて元のリストに含まれる
        selected.forEach(member => {
          expect(members.some(m => m.id === member.id)).toBe(true);
        });
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: discord-voice-roulette, Property 4: 選出人数のバリデーション
test('任意の入力値に対して、有効な範囲のみを受け付ける', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        id: fc.string(),
        username: fc.string(),
        discriminator: fc.string(),
        avatar: fc.option(fc.string()),
        displayName: fc.string()
      }), { minLength: 1, maxLength: 50 }),
      fc.integer(),
      (members, count) => {
        const engine = new RouletteEngine();
        const isValid = engine.validateCount(count, members.length);
        
        if (count >= 1 && count <= members.length) {
          expect(isValid).toBe(true);
        } else {
          expect(isValid).toBe(false);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### ユニットテスト

#### テストフレームワーク

Jest を使用してユニットテストを実装します。

#### テスト対象

1. **特定の例**
   - 認証ボタンクリック時の OAuth2 フロー開始
   - 空のメンバーリストに対するエラーメッセージ表示
   - 初回利用時のガイド表示

2. **エッジケース**
   - メンバー数が 1 人の場合のルーレット
   - 全員を選出する場合（count === members.length）
   - 非常に長いユーザー名の表示

3. **エラー条件**
   - ネットワークエラー時の再試行オプション
   - 認証失敗時のエラーメッセージ
   - レート制限時の待機処理

#### ユニットテスト例

```javascript
describe('RouletteEngine', () => {
  test('メンバーが 1 人の場合、その 1 人が選出される', () => {
    const members = [{ id: '1', username: 'user1', displayName: 'User 1' }];
    const engine = new RouletteEngine();
    const selected = engine.selectMembers(members, 1);
    
    expect(selected).toEqual(members);
  });

  test('全員を選出する場合、順序は異なるが全員が含まれる', () => {
    const members = [
      { id: '1', username: 'user1', displayName: 'User 1' },
      { id: '2', username: 'user2', displayName: 'User 2' },
      { id: '3', username: 'user3', displayName: 'User 3' }
    ];
    const engine = new RouletteEngine();
    const selected = engine.selectMembers(members, 3);
    
    expect(selected.length).toBe(3);
    members.forEach(member => {
      expect(selected.some(m => m.id === member.id)).toBe(true);
    });
  });

  test('無効な選出人数（0）はバリデーションエラー', () => {
    const engine = new RouletteEngine();
    expect(engine.validateCount(0, 5)).toBe(false);
  });

  test('無効な選出人数（負の数）はバリデーションエラー', () => {
    const engine = new RouletteEngine();
    expect(engine.validateCount(-1, 5)).toBe(false);
  });

  test('無効な選出人数（メンバー数超過）はバリデーションエラー', () => {
    const engine = new RouletteEngine();
    expect(engine.validateCount(10, 5)).toBe(false);
  });
});

describe('AuthModule', () => {
  test('ログアウト時にローカルストレージから認証情報が削除される', () => {
    localStorage.setItem('discord_token', 'test_token');
    const auth = new AuthModule();
    auth.logout();
    
    expect(localStorage.getItem('discord_token')).toBeNull();
  });
});

describe('DiscordClient', () => {
  test('レート制限エラー時に適切な待機時間を返す', async () => {
    const mockFetch = jest.fn().mockRejectedValue({
      status: 429,
      headers: { get: () => '5' }
    });
    global.fetch = mockFetch;
    
    const client = new DiscordClient('token');
    
    await expect(client.getGuilds()).rejects.toMatchObject({
      type: 'RATE_LIMIT',
      retryAfter: 5
    });
  });
});
```

### 統合テスト

GitHub Pages へのデプロイ後、以下の統合テストを手動で実行します：

1. **認証フロー**: OAuth2 認証が正常に完了すること
2. **エンドツーエンドフロー**: 認証 → サーバー選択 → チャネル選択 → ルーレット実行 → 結果表示
3. **クロスブラウザテスト**: Chrome、Firefox、Safari、Edge での動作確認
4. **モバイルテスト**: iOS Safari、Android Chrome での動作確認
5. **パフォーマンステスト**: 初期ロード時間が 3 秒以内であること

### テストカバレッジ目標

- ユニットテストカバレッジ: 80% 以上
- プロパティテストカバレッジ: すべての正確性プロパティ（13 個）
- 統合テスト: 主要フロー 5 パターン

## 実装上の注意事項

### Discord API の制約

1. **OAuth2 フロー**: Implicit Grant フローを使用（クライアントサイドのみ）
2. **必要なスコープ**: `guilds`, `guilds.members.read`
3. **レート制限**: 1 秒あたり 5 リクエスト（グローバル）、エンドポイントごとの制限あり
4. **CORS**: Discord API は CORS をサポートしているため、直接呼び出し可能

### ブラウザ互換性

- **ローカルストレージ**: すべてのモダンブラウザでサポート
- **Clipboard API**: HTTPS 環境でのみ動作
- **Fetch API**: すべてのモダンブラウザでサポート（IE11 は非対応）

### セキュリティ考慮事項

1. **トークンの保存**: セッションストレージを推奨（タブを閉じると削除される）
2. **XSS 対策**: ユーザー入力のサニタイズ、innerHTML の使用を避ける
3. **HTTPS**: GitHub Pages は自動的に HTTPS を提供
4. **最小権限の原則**: 必要最小限の API スコープのみを要求

### パフォーマンス最適化

1. **遅延ロード**: 必要なモジュールのみを読み込む
2. **キャッシング**: ギルドリスト、チャネルリストをメモリにキャッシュ
3. **デバウンス**: ユーザー入力のデバウンス処理
4. **アニメーション**: CSS アニメーションを優先（GPU アクセラレーション）

## デプロイメント

### GitHub Pages 設定

1. リポジトリの Settings → Pages
2. Source: Deploy from a branch
3. Branch: main / root
4. カスタムドメイン（オプション）

### Discord アプリケーション設定

1. Discord Developer Portal でアプリケーションを作成
2. OAuth2 設定:
   - Redirect URI: `https://{username}.github.io/{repo-name}/callback.html`
   - Scopes: `guilds`, `guilds.members.read`
3. Client ID を環境変数または設定ファイルに保存

### 環境変数

```javascript
// config.js
export const config = {
  discordClientId: 'YOUR_CLIENT_ID',
  redirectUri: 'https://yourusername.github.io/discord-voice-roulette/callback.html',
  scopes: ['guilds', 'guilds.members.read']
};
```

### ファイル構成

```
discord-voice-roulette/
├── index.html
├── callback.html
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── discord-client.js
│   ├── roulette-engine.js
│   ├── ui-controller.js
│   └── app-controller.js
├── tests/
│   ├── unit/
│   │   ├── auth.test.js
│   │   ├── roulette-engine.test.js
│   │   └── discord-client.test.js
│   └── property/
│       └── roulette.property.test.js
└── README.md
```
