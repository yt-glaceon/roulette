# 設計書：ルーレット機能拡張

## 概要

本設計書は、Discord ボイスルーレットアプリケーションに対する4つの機能拡張の実装方針を定義します。

### 機能拡張の概要

1. **ルーレット回転時間の延長**: 現在の4秒から6秒に延長し、演出効果を向上
2. **参加者の除外リスト**: VC参加者の中から特定メンバーを選出対象から除外
3. **ランダムロール付与**: 選出人数に応じた入力ボックスで役職を設定し、当選者にランダム割り当て
4. **白線回避アニメーション**: ルーレット停止位置をセクション中央に調整し、境界線上での停止を回避

### 設計方針

- 既存のコンポーネント構造を維持し、最小限の変更で機能を追加
- UIの一貫性を保ちながら、新機能を自然に統合
- 既存のテストフレームワーク（Jest、fast-check）を活用

## アーキテクチャ

### 既存アーキテクチャ

```
AppController (アプリケーション制御)
    ├── DiscordClient (Discord API通信)
    ├── RouletteEngine (選出ロジック)
    ├── UIController (UI制御)
    │   └── RouletteWheel (ルーレット描画・アニメーション)
    └── ResultManager (結果管理・コピー)
```

### 変更が必要なコンポーネント

1. **RouletteWheel**: 回転時間延長、白線回避ロジック
2. **UIController**: 除外チェックボックス、ロール入力フィールドの追加
3. **RouletteEngine**: 除外リスト対応、ロール割り当てロジック
4. **ResultManager**: ロール付き結果のコピー対応
5. **AppController**: 除外リスト・ロールの状態管理

## コンポーネントとインターフェース

### RouletteWheel の拡張

#### 変更メソッド

**`spin(selectedMember, options)`**
```javascript
/**
 * ルーレットを回転
 * @param {Object} selectedMember - 選出されたメンバー
 * @param {Object} options - オプション設定
 * @param {number} options.duration - 回転時間（ミリ秒）デフォルト: 6000
 * @param {number} options.minRotations - 最低回転数 デフォルト: 5
 * @returns {Promise<void>}
 */
async spin(selectedMember, options = {})
```

**`calculateTargetAngle(selectedIndex, anglePerMember)`**
```javascript
/**
 * 停止角度を計算（白線回避）
 * @param {number} selectedIndex - 選出されたメンバーのインデックス
 * @param {number} anglePerMember - メンバーごとの角度
 * @returns {number} 調整された停止角度
 */
calculateTargetAngle(selectedIndex, anglePerMember)
```

#### 実装詳細

- 回転時間を4秒から6秒に変更
- 最低回転数を3〜5回から5〜7回に変更
- 停止角度計算時に、セクション中央（`anglePerMember / 2`）を基準とし、白線から5度以上離れるように調整

### UIController の拡張

#### 新規メソッド

**`createMemberCardWithExclusion(member)`**
```javascript
/**
 * 除外チェックボックス付きメンバーカードを作成
 * @param {Object} member - メンバー情報
 * @returns {HTMLElement} メンバーカード
 */
createMemberCardWithExclusion(member)
```

**`createRoleInputFields(count)`**
```javascript
/**
 * ロール入力フィールドを作成
 * @param {number} count - 選出人数
 * @returns {HTMLElement} ロール入力コンテナ
 */
createRoleInputFields(count)
```

**`updateRoleInputFields(count)`**
```javascript
/**
 * ロール入力フィールドを更新
 * @param {number} count - 新しい選出人数
 */
updateRoleInputFields(count)
```

#### 実装詳細

- 選出人数が増加した場合、新しいフィールドを追加
- 選出人数が減少した場合、余分なフィールドを即座に削除（DOMから削除）
- アニメーション画面では、ロール入力フィールドを `display: 'none'` で非表示

**`getExcludedMemberIds()`**
```javascript
/**
 * 除外されたメンバーIDのリストを取得
 * @returns {Array<string>} 除外メンバーIDの配列
 */
getExcludedMemberIds()
```

**`getRoles()`**
```javascript
/**
 * 入力されたロールのリストを取得
 * @returns {Array<string>} ロールの配列（空文字列は除外）
 */
getRoles()
```

#### 変更メソッド

**`animateRoulette(members, selected)`**
```javascript
/**
 * ルーレットアニメーションを実行
 * @param {Array} members - 全メンバー（除外後）
 * @param {Array} selected - 選出されたメンバー
 * @returns {Promise<void>}
 */
async animateRoulette(members, selected)
```

#### 実装詳細

- ルーレットホイールには除外後の全メンバー（`availableMembers`）を表示
- 針が止まる位置は、開始時に選出された `selected` メンバーを順に指す
- 各選出メンバーに対してルーレットを回転（6秒間）
- 最後のアニメーション終了後、1秒待ってから結果ボタンを表示
- アニメーション画面では、メンバーリスト、コントロール、ロール入力フィールドを非表示

**`createResultCard(member, order, role)`**
```javascript
/**
 * 結果カードを作成（ロール対応）
 * @param {Object} member - メンバー情報
 * @param {number} order - 選出順序
 * @param {string|null} role - 割り当てられたロール
 * @returns {HTMLElement} 結果カード
 */
createResultCard(member, order, role)
```

### RouletteEngine の拡張

#### 新規メソッド

**`selectMembersWithExclusion(members, count, excludedIds)`**
```javascript
/**
 * 除外リストを考慮してメンバーを選出
 * @param {Array} members - 全メンバーリスト
 * @param {number} count - 選出人数
 * @param {Array<string>} excludedIds - 除外するメンバーIDの配列
 * @returns {Array} 選出されたメンバー
 * @throws {Error} 選出可能なメンバーが不足している場合
 */
selectMembersWithExclusion(members, count, excludedIds)
```

**`assignRoles(selectedMembers, roles)`**
```javascript
/**
 * 選出されたメンバーにロールをランダム割り当て
 * @param {Array} selectedMembers - 選出されたメンバー
 * @param {Array<string>} roles - ロールのリスト
 * @returns {Array} ロール付きメンバー情報 [{member, role}, ...]
 */
assignRoles(selectedMembers, roles)
```

#### 実装詳細

**除外リスト処理**:
1. 全メンバーから除外IDに一致するメンバーを除外
2. 残りのメンバーから選出
3. 選出可能なメンバー数が選出人数より少ない場合はエラー

**ロール割り当て**:
1. 入力されたロールリスト（空文字列を除外）を取得
2. ロールリストをシャッフル
3. 選出されたメンバーに順番に割り当て
4. ロールが空の場合は `null` を割り当て

### ResultManager の拡張

#### 変更メソッド

**`copyToClipboard(selectedMembers, withRoles)`**
```javascript
/**
 * 結果をクリップボードにコピー（ロール対応）
 * @param {Array} selectedMembers - 選出されたメンバー
 * @param {boolean} withRoles - ロールを含めるかどうか
 * @returns {Promise<boolean>} 成功したかどうか
 */
async copyToClipboard(selectedMembers, withRoles = false)
```

#### 実装詳細

ロール付きの場合のフォーマット:
```
1. 太郎 - リーダー
2. 花子 - サポート
3. 次郎
```

ロールなしの場合は既存フォーマットを維持:
```
1. 太郎
2. 花子
3. 次郎
```

### AppController の拡張

#### 変更メソッド

**`handleRouletteExecution(count)`**
- 除外リストを取得
- ロールリストを取得
- 除外リストを考慮してメンバー選出
- ロールを割り当て
- ルーレットアニメーション実行

**`setupEventListeners()`**
- 選出人数変更時のロール入力フィールド更新リスナーを追加
- 除外チェックボックス変更時の選出可能人数更新リスナーを追加

## データモデル

### Member（既存）

```javascript
{
  id: string,           // Discord ユーザーID
  displayName: string,  // 表示名
  avatar: string|null   // アバターURL
}
```

### MemberWithRole（新規）

```javascript
{
  member: Member,       // メンバー情報
  role: string|null     // 割り当てられたロール（なければ null）
}
```

### RouletteOptions（新規）

```javascript
{
  duration: number,     // 回転時間（ミリ秒）デフォルト: 6000
  minRotations: number  // 最低回転数 デフォルト: 5
}
```

### ExclusionState（新規）

```javascript
{
  excludedIds: Array<string>,  // 除外されたメンバーIDの配列
  availableCount: number       // 選出可能なメンバー数
}
```

### RoleAssignment（新規）

```javascript
{
  roles: Array<string>,        // 入力されたロールのリスト
  assignments: Map<string, string>  // メンバーID -> ロールのマッピング
}
```


## 正確性プロパティ

プロパティとは、システムのすべての有効な実行において真であるべき特性や動作のことです。プロパティは、人間が読める仕様と機械で検証可能な正確性保証の橋渡しとなります。

### プロパティ 1: ルーレット回転時間

*すべての*ルーレット実行において、開始から停止までの時間は6秒（±100ms）である

**検証要件: 1.1**

### プロパティ 2: 最低回転数

*すべての*ルーレット実行において、回転数は5回転以上である

**検証要件: 1.3**

### プロパティ 3: 除外メンバーの選出防止

*すべての*メンバーリストと除外リストの組み合わせにおいて、選出されたメンバーは除外リストに含まれていない

**検証要件: 2.2**

### プロパティ 4: 除外後のルーレット表示

*すべての*メンバーリストと除外リストの組み合わせにおいて、ルーレットに表示されるセクション数は（全メンバー数 - 除外メンバー数）と等しく、針は選出されたメンバーを順に指す

**検証要件: 2.3, 2.4**

### プロパティ 5: 選出可能人数の上限更新

*すべての*メンバーリストと除外リストの組み合わせにおいて、選出可能人数の上限は（全メンバー数 - 除外メンバー数）と等しい

**検証要件: 2.6**

### プロパティ 6: ロール入力フィールド数の同期

*すべての*選出人数の変更において、表示されるロール入力フィールドの数は選出人数と等しい

**検証要件: 3.2**

### プロパティ 7: 入力フィールドの削除

*すべての*選出人数の減少において、削除されたフィールドは即座にDOMから削除される

**検証要件: 3.3**

### プロパティ 8: アニメーション画面でのロール入力非表示

*すべての*ルーレットアニメーション実行において、ロール入力フィールドは非表示になる

**検証要件: 3.4**

### プロパティ 9: ロールのシャッフル割り当て

*すべての*ロールリスト（空文字列を除く）と選出メンバーの組み合わせにおいて、各ロールは正確に1回ずつ割り当てられ、ロールが入力されていない当選者には null が割り当てられる

**検証要件: 3.6, 3.8**

### プロパティ 10: ロール付き結果のコピー

*すべての*ロール付きメンバーリストにおいて、クリップボードにコピーされるテキストは各メンバーの名前とロールを含む

**検証要件: 3.10**

### プロパティ 11: 白線回避の停止角度

*すべての*メンバー数と選出インデックスの組み合わせにおいて、計算された停止角度はセクション中央から±30度以内で、かつ白線（セクション境界）から5度以上離れている

**検証要件: 4.1, 4.2, 4.3**

### プロパティ 12: アニメーション完了後の停止位置

*すべての*ルーレット実行において、アニメーション完了後の針の位置は選出されたメンバーのセクション内にある

**検証要件: 4.4**

### プロパティ 13: 結果ボタンの表示タイミング

*すべての*ルーレット実行において、結果ボタンは最後のアニメーション完了後1秒後に表示される

**検証要件: 1.1**

### プロパティ 14: 既存選出ロジックの保持

*すべての*メンバーリストと選出人数の組み合わせにおいて、除外リストが空の場合、選出結果は既存のselectMembersメソッドと同じ動作をする

**検証要件: 5.1**

### プロパティ 15: 既存結果保存機能の保持

*すべての*選出結果において、ロールが指定されていない場合、saveToHistoryは既存のフォーマットで履歴を保存する

**検証要件: 5.3**

### プロパティ 16: 既存コピー機能の保持

*すべての*選出結果において、ロールが指定されていない場合、copyToClipboardは既存のフォーマットでテキストを生成する

**検証要件: 5.4**

## エラーハンドリング

### 除外リストのエラー

**エラーケース**: すべてのメンバーが除外された場合

**処理**:
- エラーメッセージ: "選出可能なメンバーがいません。除外設定を確認してください。"
- ルーレット開始ボタンを無効化
- 選出人数の上限を0に設定

**エラーケース**: 選出人数が選出可能なメンバー数を超える場合

**処理**:
- エラーメッセージ: "選出人数が選出可能なメンバー数を超えています。"
- 選出人数を自動的に選出可能な最大値に調整

### ロール入力のエラー

**エラーケース**: ロール入力フィールドが存在しない場合

**処理**:
- ロールなしで通常通りルーレットを実行
- エラーを発生させない（後方互換性）

### アニメーションのエラー

**エラーケース**: ルーレットが既に回転中の場合

**処理**:
- 新しいスピンリクエストを無視
- `isSpinning` フラグで制御

**エラーケース**: 選出されたメンバーがメンバーリストに存在しない場合

**処理**:
- エラーメッセージ: "選出されたメンバーが見つかりません。"
- ルーレットを停止

## テスト戦略

### デュアルテストアプローチ

本プロジェクトでは、ユニットテストとプロパティベーステストの両方を使用します。

- **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- **プロパティテスト**: すべての入力に対する普遍的なプロパティを検証

両者は補完的であり、包括的なカバレッジを実現します。

### プロパティベーステスト設定

**使用ライブラリ**: fast-check（既存プロジェクトで使用中）

**設定**:
- 各プロパティテストは最低100回の反復を実行
- 各テストには設計書のプロパティ番号を参照するタグを付与
- タグフォーマット: `Feature: roulette-enhancements, Property N: [プロパティ名]`

### テストカバレッジ

#### ユニットテスト

**RouletteWheel**:
- 回転時間が6秒であることを確認（例）
- 白線回避ロジックの境界値テスト（エッジケース）
- アニメーション中の重複スピン防止（エッジケース）

**UIController**:
- 除外チェックボックスの表示（例）
- ロール入力フィールドの表示（例）
- 選出人数変更時のフィールド更新（例）
- すべてのメンバーが除外された場合のエラー表示（エッジケース）

**RouletteEngine**:
- 除外リストが空の場合の動作（例）
- ロールが入力されていない場合の動作（エッジケース）
- 一部のロールのみ入力されている場合の動作（例）

**ResultManager**:
- ロール付き結果のコピーフォーマット（例）
- ロールなし結果のコピーフォーマット（例）

#### プロパティテスト

各正確性プロパティ（プロパティ1〜14）に対して、対応するプロパティベーステストを実装します。

**生成戦略**:
- メンバーリスト: 1〜20人のランダムなメンバー
- 除外リスト: 0〜メンバー数-1のランダムな除外
- 選出人数: 1〜選出可能なメンバー数
- ロールリスト: 0〜選出人数のランダムなロール（一部空文字列を含む）
- メンバー数: 2〜20（ルーレット表示用）

### テストファイル構成

```
tests/
├── unit/
│   ├── roulette-wheel.test.js
│   ├── ui-controller.test.js
│   ├── roulette-engine.test.js
│   └── result-manager.test.js
└── property/
    ├── roulette-wheel.property.test.js
    ├── ui-controller.property.test.js
    ├── roulette-engine.property.test.js
    └── result-manager.property.test.js
```

### 継続的インテグレーション

- すべてのテストはコミット前に実行
- プロパティテストの失敗時は、失敗した入力を記録
- カバレッジ目標: 80%以上（既存機能を含む）
