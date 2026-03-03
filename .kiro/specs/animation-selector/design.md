# 設計書: アニメーション方式選択機能

## アーキテクチャ

### コンポーネント構成

```
UIController
    ├── RouletteWheel (既存)
    ├── SlotMachineAnimation (新規)
    ├── CardFlipAnimation (新規)
    └── DrumRollAnimation (新規)
```

### クラス設計

#### 1. 共通インターフェース

すべてのアニメーションクラスは以下のインターフェースを実装:

```javascript
class AnimationBase {
    constructor(container) {}
    initialize(members) {}
    async spin(selectedMember, options = {}) {}
    destroy() {}
}
```

#### 2. SlotMachineAnimation

**責務:** スロットマシン風のアニメーション

**プロパティ:**
- `container`: DOM要素
- `members`: メンバーリスト
- `columns`: スロット列の配列
- `isSpinning`: アニメーション中フラグ

**メソッド:**
- `initialize(members)`: スロット列を生成
- `spin(selectedMember, options)`: アニメーション実行
- `createColumn(index)`: 列を作成
- `animateColumn(column, targetMember, delay)`: 列をアニメーション
- `destroy()`: クリーンアップ

**アニメーション仕様:**
- 3列のスロット
- 各列に全メンバーのアイコンを縦に配置
- 高速スクロール（初速: 100px/frame）
- イージング: ease-out
- 停止時間差: 1秒

#### 3. CardFlipAnimation

**責務:** カードめくり風のアニメーション

**プロパティ:**
- `container`: DOM要素
- `members`: メンバーリスト
- `cards`: カード要素の配列
- `isSpinning`: アニメーション中フラグ

**メソッド:**
- `initialize(members)`: カードグリッドを生成
- `spin(selectedMember, options)`: アニメーション実行
- `createCard(member)`: カードを作成
- `highlightCard(card, isSelected)`: カードを強調
- `destroy()`: クリーンアップ

**アニメーション仕様:**
- グリッドレイアウト（4列）
- 全カードを表示
- ランダムな順序で光るエフェクト（0.1秒間隔）
- 選出されたカードは拡大＋色変更
- 非選出カードは半透明化

#### 4. DrumRollAnimation

**責務:** ドラムロール風のアニメーション

**プロパティ:**
- `container`: DOM要素
- `members`: メンバーリスト
- `currentIndex`: 現在表示中のインデックス
- `isSpinning`: アニメーション中フラグ
- `intervalId`: タイマーID

**メソッド:**
- `initialize(members)`: 中央表示エリアを生成
- `spin(selectedMember, options)`: アニメーション実行
- `showMember(member)`: メンバーを表示
- `destroy()`: クリーンアップ

**アニメーション仕様:**
- 中央に大きなアイコン（150px）
- 初期速度: 50ms/切り替え
- 減速カーブ: 指数関数的
- 最終速度: 500ms/切り替え
- 合計時間: 約3秒

### UI設計

#### アニメーション選択ドロップダウン

**配置:** ルーレット画面の「選出人数」の下

**HTML構造:**
```html
<div class="animation-selector">
    <label for="animation-type">アニメーション方式:</label>
    <select id="animation-type" class="animation-select">
        <option value="wheel">円形ルーレット</option>
        <option value="slot">スロットマシン</option>
        <option value="card">カードめくり</option>
        <option value="drum">ドラムロール</option>
    </select>
</div>
```

**CSS:**
```css
.animation-selector {
    margin: 20px 0;
}

.animation-select {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    border: 2px solid #5865F2;
    border-radius: 8px;
}
```

### データフロー

#### 1. 初期化時
```
UIController.showRouletteScreen()
    → localStorage から設定を読み込み
    → ドロップダウンの値を設定
```

#### 2. アニメーション選択時
```
ユーザーがドロップダウンを変更
    → イベントリスナーが発火
    → localStorage に保存
```

#### 3. ルーレット実行時
```
UIController.animateRoulette()
    → 選択されたアニメーション方式を取得
    → 対応するアニメーションクラスをインスタンス化
    → initialize() → spin() を実行
```

### ファイル構成

```
js/
├── animations/
│   ├── animation-base.js       # 基底クラス（オプション）
│   ├── roulette-wheel.js       # 既存（移動）
│   ├── slot-machine.js         # 新規
│   ├── card-flip.js            # 新規
│   └── drum-roll.js            # 新規
├── app-controller.js
├── ui-controller.js            # 修正
└── ...
```

### LocalStorage設計

**キー:** `roulette_animation_type`

**値:**
- `wheel`: 円形ルーレット（デフォルト）
- `slot`: スロットマシン
- `card`: カードめくり
- `drum`: ドラムロール

**保存タイミング:** ドロップダウン変更時

**読み込みタイミング:** ルーレット画面表示時

**初期値の扱い:**
- localStorageに値がない場合: `wheel`（円形ルーレット）をデフォルトとして使用
- localStorageに値がある場合: その値をドロップダウンの初期値として設定

### エラーハンドリング

#### 1. アニメーションクラスの読み込み失敗
- フォールバック: 円形ルーレット
- エラーログ出力

#### 2. localStorage アクセス失敗
- デフォルト値（wheel）を使用
- エラーログ出力

#### 3. アニメーション実行中のエラー
- アニメーションを停止
- 結果画面を直接表示
- エラーメッセージ表示

## レスポンシブ対応

### ブレークポイント
- デスクトップ: 768px以上
- モバイル: 768px未満

### 各アニメーションの調整

#### スロットマシン
- デスクトップ: 3列
- モバイル: 1列（縦長）

#### カードめくり
- デスクトップ: 4列グリッド
- モバイル: 2列グリッド

#### ドラムロール
- デスクトップ: アイコン150px
- モバイル: アイコン100px

## パフォーマンス最適化

### 1. アニメーション
- CSS transformを使用（GPU加速）
- requestAnimationFrame を使用
- 不要な再描画を避ける

### 2. メモリ管理
- destroy() で適切にクリーンアップ
- イベントリスナーを削除
- タイマーをクリア

### 3. 画像最適化
- アバター画像のキャッシュ
- 遅延読み込み（必要に応じて）

## テスト戦略

### 単体テスト
- 各アニメーションクラスの初期化
- spin() メソッドの動作
- destroy() のクリーンアップ

### 統合テスト
- UIController との連携
- localStorage の保存・読み込み
- アニメーション切り替え

### E2Eテスト
- ユーザーフローの確認
- 各アニメーションの実行
- 設定の永続化

## 実装順序

### Phase 1: 基盤整備
1. ファイル構成の整理
2. UIにドロップダウン追加
3. localStorage 連携

### Phase 2: アニメーション実装
1. SlotMachineAnimation
2. DrumRollAnimation
3. CardFlipAnimation

### Phase 3: 統合・テスト
1. UIController の修正
2. 既存機能との統合テスト
3. レスポンシブ対応確認

### Phase 4: 仕上げ
1. エラーハンドリング
2. パフォーマンス最適化
3. ドキュメント更新
