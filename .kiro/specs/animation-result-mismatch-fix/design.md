# アニメーション結果不一致バグ修正設計

## 概要

Discordルーレットアプリケーションにおいて、2つの重大なアニメーションバグが発生しています。

1. **円形ルーレットの結果不一致**: 1人以上の選出時、2回目以降のアニメーションで針が指すユーザーと最終的な選出結果が異なる（1回目は正常に動作）
2. **スロットマシンの左端停止**: 一番左のスロット（インデックス0）が回転せず、アニメーション開始時から結果が確定している

これらのバグは、アニメーション状態の管理不備と計算ロジックの誤りに起因しています。円形ルーレットでは、前回のアニメーション終了時の`rotation`値が保持されたまま次のアニメーションが開始されるため、1回目は正しく動作するが2回目以降で結果不一致が発生します。本設計では、状態リセット処理の追加とアニメーション時間計算の修正により、最小限の変更で確実にバグを修正します。

## 用語集

- **Bug_Condition (C)**: バグが発生する条件
  - C1: 円形ルーレットで2回目以降のアニメーション実行時に`rotation`値がリセットされない
  - C2: スロットマシンで列インデックス0に対して`columnDuration`が負の値になる
- **Property (P)**: バグ修正後の期待される動作
  - P1: 各回のアニメーションで針が指すユーザーが選出結果と一致する
  - P2: すべてのスロット列が正常に回転し、順番に停止する
- **Preservation**: 修正によって影響を受けてはならない既存の動作
  - 1人選出時の正常動作、回転速度・イージング効果、他のアニメーション方式
- **rotation**: `RouletteWheel`クラスのプロパティで、ルーレットの現在の回転角度（ラジアン）を保持
- **targetRotation**: アニメーション終了時の目標回転角度
- **columnDuration**: 各スロット列のアニメーション時間（ミリ秒）

## バグ詳細

### 障害条件

#### バグ1: 円形ルーレットの結果不一致

1人以上の選出時、`RouletteWheel.spin()`メソッドが2回目以降に呼び出されると、前回のアニメーション終了時の`rotation`値が保持されたまま次のアニメーションが開始されます。1回目のアニメーションでは`rotation`が初期値0から開始されるため正しく動作しますが、2回目以降は前回の終了位置を基準として目標角度が計算されるため、針が指す位置と選出結果が一致しなくなります。

**形式的仕様:**
```
FUNCTION isBugCondition_Roulette(input)
  INPUT: input of type { animationCount: number, rotation: number }
  OUTPUT: boolean
  
  RETURN input.animationCount >= 2
         AND input.rotation != 0
         AND NOT rotationResetBeforeAnimation()
END FUNCTION
```

#### バグ2: スロットマシンの左端停止

`SlotMachineAnimation.spin()`メソッドで各列のアニメーション時間を計算する際、`columnDuration = duration - (i * columnDelay)`という式を使用しています。列インデックス`i = 0`の場合、`columnDuration = duration - 0 = duration`となり、最も長い時間が設定されます。しかし、ループ内で`i = 0`の列をアニメーション開始後、`columnDelay`時間待機してから次の列に進むため、実質的に列0は`duration`時間回転し続け、他の列が停止した後も回転し続けることになります。

実際のコードでは、列0に対して`animateColumn()`が呼び出された直後に`await this.sleep(columnDelay)`で1000ms待機し、その間に列0のアニメーションが進行します。しかし、`columnDuration`が最大値のため、列0は最後まで回転し続け、視覚的には「停止している」ように見えます。

**形式的仕様:**
```
FUNCTION isBugCondition_Slot(input)
  INPUT: input of type { columnIndex: number, duration: number, columnDelay: number }
  OUTPUT: boolean
  
  RETURN input.columnIndex == 0
         AND columnDuration = input.duration - (0 * input.columnDelay)
         AND columnDuration >= input.duration
         AND NOT (columnDuration > 0 AND columnDuration < input.duration)
END FUNCTION
```

### 具体例

#### 円形ルーレットの例

- **1回目のアニメーション**: 「太郎」を選出 → `rotation = 0`から開始し、正しく「太郎」を指して`25.13`ラジアンで終了
- **2回目のアニメーション**: 「花子」を選出すべきだが、`rotation = 25.13`から開始 → 計算された目標角度が`25.13`を基準とするため、針が「次郎」を指してしまう
- **期待される動作**: 1回目と同様に`rotation = 0`から開始し、「花子」を正確に指す

#### スロットマシンの例

- **列0（左端）**: `columnDuration = 6000 - (0 * 1000) = 6000ms` → 6秒間回転
- **列1（中央）**: `columnDuration = 6000 - (1 * 1000) = 5000ms` → 5秒間回転
- **列2（右端）**: `columnDuration = 6000 - (2 * 1000) = 4000ms` → 4秒間回転
- **実際の動作**: 列0が最後まで回転し続け、列2が最初に停止する（逆順）
- **期待される動作**: 列0が最初に停止し、列1、列2の順に停止する

#### エッジケース

- **円形ルーレット**: 10回連続で選出を行った場合、`rotation`値が非常に大きくなり、浮動小数点の精度問題が発生する可能性
- **スロットマシン**: `columnDelay`が`duration`より大きい場合、後半の列で`columnDuration`が負の値になる

## 期待される動作

### 保持要件

**変更されない動作:**
- 円形ルーレットの回転速度、イージング効果（減速カーブ）、視覚効果（色、境界線、針の描画）が維持されること
- スロットマシンで中央と右端のスロット（インデックス1, 2）の相対的な停止タイミング差が維持されること
- スロットマシンの視覚効果（アバター表示、スクロールアニメーション、イージング）が維持されること
- 他のアニメーション方式（カードフリップ、ドラムロール）が正常に動作すること
- ユーザーが設定したアニメーション時間やオプションが正しく適用されること

**スコープ:**
以下の入力は今回の修正の影響を受けません:
- マウスクリックやキーボード入力などのユーザーインタラクション
- アニメーション以外の機能（メンバー管理、設定画面、結果表示）
- 他のアニメーション方式の実行

## 根本原因の仮説

コード分析に基づき、以下の根本原因を特定しました:

### 1. **円形ルーレット: 状態リセットの欠如**

`RouletteWheel`クラスの`spin()`メソッドは、アニメーション開始時に`rotation`値をリセットしていません。`initialize()`メソッドでは`this.rotation = 0`と初期化されますが、`spin()`メソッドは既存の`rotation`値を基準に目標角度を計算します。

**問題のコード（roulette-wheel.js:133-136）:**
```javascript
// 最低回転数を保証（minRotations 以上）
const extraRotations = minRotations + Math.random() * 2;
this.targetRotation = this.rotation + (Math.PI * 2 * extraRotations) + targetAngle;
```

この計算式では、`this.rotation`が前回のアニメーション終了時の値を保持しているため、2回目以降のアニメーションで意図しない位置から回転が始まります。

### 2. **スロットマシン: アニメーション時間計算の誤り**

`SlotMachineAnimation`クラスの`spin()`メソッドで、各列のアニメーション時間を`duration - (i * columnDelay)`と計算しています。これは「後の列ほど早く停止する」という意図ですが、実際には逆の結果になります。

**問題のコード（slot-machine.js:113-114）:**
```javascript
const column = this.columns[i];
const columnDuration = duration - (i * columnDelay);
```

列0（左端）は`duration`時間、列1は`duration - columnDelay`時間、列2は`duration - 2*columnDelay`時間となり、列0が最も長く回転します。しかし、ループ内で各列を順番に開始し、`columnDelay`ずつ待機するため、実際の停止順序は逆になります。

### 3. **スロットマシン: 非同期処理の誤解**

`animateColumn()`メソッドは非同期処理を行わず、CSS transitionを設定するだけです。そのため、`await this.sleep(columnDelay)`で待機しても、列のアニメーションは並行して進行します。

**問題のコード（slot-machine.js:116-122）:**
```javascript
// 列をアニメーション（非同期で開始）
this.animateColumn(column, selectedMember, selectedIndex, columnDuration);

// 次の列まで待機
if (i < this.columns.length - 1) {
    await this.sleep(columnDelay);
}
```

このコードは「列を順番に開始する」意図ですが、`animateColumn()`が即座に戻るため、実際には全列がほぼ同時に開始され、`columnDuration`の違いだけで停止タイミングが決まります。

### 4. **スロットマシン: 最終待機時間の計算誤り**

最後の待機時間を`duration - (this.columns.length - 1) * columnDelay`と計算していますが、これは列2のアニメーション時間と一致しません。

**問題のコード（slot-machine.js:125）:**
```javascript
await this.sleep(duration - (this.columns.length - 1) * columnDelay);
```

列2の`columnDuration`は`duration - 2 * columnDelay`なので、この待機時間は列2の停止を待つには不十分です。

## 正当性プロパティ

Property 1: 障害条件 - 円形ルーレットのアニメーション結果一致

_任意の_ 円形ルーレットアニメーション実行において、1人以上の選出時の各回（1回目、2回目以降すべて）のアニメーションで針が指すユーザーが、選出結果として指定された`selectedMember`と完全に一致すること。修正後の`spin()`メソッドは、アニメーション開始時に`rotation`を0にリセットし、常に同じ初期位置から目標角度を計算することで、1回目だけでなく2回目以降も針の指す位置と選出結果の一致を保証する。

**検証: 要件 2.1, 2.2**

Property 2: 障害条件 - スロットマシンの全列回転

_任意の_ スロットマシンアニメーション実行において、一番左のスロット（インデックス0）を含むすべてのスロット列が正常に回転し、左から右へ順番に停止すること。修正後の`spin()`メソッドは、各列の`columnDuration`を`(i + 1) * columnDelay`と計算することで、列0が最初に停止し、列1、列2の順に停止することを保証する。

**検証: 要件 2.3, 2.4**

Property 3: 保持 - 既存アニメーション動作の維持

_任意の_ 入力において、バグ条件に該当しない場合（スロットマシンの列1・2の動作、他のアニメーション方式）、修正後のコードは修正前と完全に同じ動作を生成し、既存の視覚効果、タイミング、ユーザー体験を保持すること。円形ルーレットについては、`rotation`リセット処理により1回目も2回目以降も同じ初期状態から開始するため、視覚効果とタイミングは維持される。

**検証: 要件 3.1, 3.2, 3.3, 3.4, 3.5**

## 修正実装

根本原因分析が正しいと仮定した場合の修正内容:

### 変更1: 円形ルーレットの状態リセット

**ファイル**: `js/animations/roulette-wheel.js`

**メソッド**: `spin(selectedMember, options = {})`

**具体的な変更**:
1. **`rotation`のリセット**: `spin()`メソッドの開始時に`this.rotation = 0`を追加
   - 位置: `this.isSpinning = true;`の直後
   - 理由: 各アニメーションを常に同じ初期位置（0ラジアン）から開始することで、目標角度の計算が一貫性を持つ

2. **目標角度計算の簡素化**: `this.targetRotation`の計算式を修正
   - 変更前: `this.targetRotation = this.rotation + (Math.PI * 2 * extraRotations) + targetAngle;`
   - 変更後: `this.targetRotation = (Math.PI * 2 * extraRotations) + targetAngle;`
   - 理由: `this.rotation`が常に0なので、計算式から除外して明確化

3. **コメントの追加**: 状態リセットの意図を明確にするコメントを追加

### 変更2: スロットマシンのアニメーション時間計算修正

**ファイル**: `js/animations/slot-machine.js`

**メソッド**: `spin(selectedMember, options = {})`

**具体的な変更**:
1. **`columnDuration`の計算式修正**: 列が左から右へ順番に停止するように修正
   - 変更前: `const columnDuration = duration - (i * columnDelay);`
   - 変更後: `const columnDuration = (i + 1) * columnDelay;`
   - 理由: 列0は`columnDelay`時間、列1は`2 * columnDelay`時間、列2は`3 * columnDelay`時間で停止

2. **最終待機時間の修正**: 最後の列が停止するまで正確に待機
   - 変更前: `await this.sleep(duration - (this.columns.length - 1) * columnDelay);`
   - 変更後: `await this.sleep(this.columns.length * columnDelay);`
   - 理由: 列2の`columnDuration`は`3 * columnDelay`なので、それに合わせる

3. **`duration`パラメータの扱い**: `duration`は全体の最大時間として保持し、各列の時間は`columnDelay`を基準に計算
   - 注意: この変更により、`duration`パラメータの意味が変わる可能性があるため、呼び出し側の調整が必要かどうか確認

4. **コメントの追加**: 計算ロジックの意図を明確にするコメントを追加

### 変更3: エッジケースの処理

**ファイル**: `js/animations/roulette-wheel.js`

**追加処理**:
1. **`rotation`の正規化**: 非常に大きな値になった場合、`2π`の剰余を取る
   - 位置: `this.rotation = this.targetRotation;`の直後
   - 実装: `this.rotation = this.rotation % (Math.PI * 2);`
   - 理由: 浮動小数点の精度問題を回避

**ファイル**: `js/animations/slot-machine.js`

**追加処理**:
1. **`columnDelay`の検証**: `columnDelay`が適切な範囲にあることを確認
   - 位置: `spin()`メソッドの開始時
   - 実装: `if (columnDelay <= 0 || columnDelay * this.columns.length > duration) { /* エラー処理 */ }`
   - 理由: 不正な値による予期しない動作を防止

## テスト戦略

### 検証アプローチ

テスト戦略は2段階のアプローチを採用します: まず、未修正コードでバグを再現する探索的テストを実行し、根本原因分析を確認します。次に、修正後のコードで修正検証と保持検証を行い、バグが解消され、既存動作が維持されていることを確認します。

### 探索的障害条件検証

**目標**: 修正を実装する前に、未修正コードでバグを再現し、根本原因分析を確認または反証します。反証された場合は、再度仮説を立て直します。

**テスト計画**: 円形ルーレットとスロットマシンのアニメーションを実行し、バグの発生を観察します。未修正コードで実行し、失敗パターンを記録して根本原因を理解します。

**テストケース**:
1. **円形ルーレット1回目と2回目の比較テスト**: 1人選出時、1回目のアニメーション後に`rotation`値を記録し、2回目のアニメーション開始時に`rotation`が0にリセットされていないことを確認（未修正コードで失敗）
2. **円形ルーレット針位置検証テスト**: 2回目のアニメーション終了時、針が指す位置（`rotation`値から計算）と選出された`selectedMember`のインデックスが一致しないことを確認（未修正コードで失敗）
3. **スロットマシン列0停止テスト**: アニメーション実行時、列0の`columnDuration`が`duration`と等しく、他の列より長いことを確認（未修正コードで失敗）
4. **スロットマシン停止順序テスト**: アニメーション実行時、列の停止順序が列2→列1→列0の順（逆順）になることを確認（未修正コードで失敗）

**期待される反例**:
- 円形ルーレット: 2回目のアニメーションで`rotation`が前回の終了値を保持し、針の指す位置が選出結果と一致しない
- スロットマシン: 列0の`columnDuration`が最大値となり、列0が最後まで回転し続ける
- 可能性のある原因: 状態リセットの欠如、アニメーション時間計算の誤り、非同期処理の誤解

### 修正検証

**目標**: バグ条件に該当するすべての入力において、修正後の関数が期待される動作を生成することを検証します。

**疑似コード:**
```
FOR ALL input WHERE isBugCondition_Roulette(input) DO
  result := RouletteWheel.spin_fixed(input.selectedMember)
  ASSERT result.rotation == expectedRotation(input.selectedMember)
  ASSERT pointerPosition(result.rotation) == input.selectedMember.index
END FOR

FOR ALL input WHERE isBugCondition_Slot(input) DO
  result := SlotMachineAnimation.spin_fixed(input.selectedMember)
  ASSERT result.column0Duration > 0
  ASSERT result.column0Duration < result.column1Duration
  ASSERT result.column1Duration < result.column2Duration
END FOR
```

### 保持検証

**目標**: バグ条件に該当しないすべての入力において、修正後の関数が修正前と同じ結果を生成することを検証します。

**疑似コード:**
```
FOR ALL input WHERE NOT isBugCondition_Roulette(input) DO
  ASSERT RouletteWheel.spin_original(input) == RouletteWheel.spin_fixed(input)
END FOR

FOR ALL input WHERE NOT isBugCondition_Slot(input) DO
  ASSERT SlotMachineAnimation.spin_original(input) == SlotMachineAnimation.spin_fixed(input)
END FOR
```

**テストアプローチ**: プロパティベーステストは保持検証に推奨されます。理由:
- 入力ドメイン全体で多数のテストケースを自動生成
- 手動ユニットテストでは見逃しがちなエッジケースを検出
- バグ条件に該当しないすべての入力で動作が変更されていないことを強力に保証

**テスト計画**: まず未修正コードで既存動作を観察し、その動作を捉えるプロパティベーステストを作成します。

**テストケース**:
1. **円形ルーレット1回目実行保持**: 未修正コードで1回目のアニメーションが正常に動作することを観察し、修正後も同じ動作を維持することをテスト（`rotation`リセット処理により1回目も2回目以降も同じ初期状態から開始するため、視覚効果は維持される）
2. **円形ルーレット視覚効果保持**: 未修正コードで回転速度、イージング、色、境界線が正しく表示されることを観察し、修正後も同じ視覚効果を維持することをテスト
3. **スロットマシン列1・2保持**: 未修正コードで列1と列2が正常に回転・停止することを観察し、修正後も同じ動作を維持することをテスト
4. **スロットマシン視覚効果保持**: 未修正コードでアバター表示、スクロールアニメーション、イージングが正しく動作することを観察し、修正後も同じ視覚効果を維持することをテスト

### ユニットテスト

- 円形ルーレットの`spin()`メソッドで`rotation`が0にリセットされることをテスト
- 円形ルーレットの2回連続実行で、各回の針位置が選出結果と一致することをテスト
- スロットマシンの`columnDuration`計算が正しいことをテスト（列0 < 列1 < 列2）
- スロットマシンの停止順序が左から右へ順番であることをテスト
- エッジケース: 10回連続実行後の`rotation`値が正規化されることをテスト
- エッジケース: 不正な`columnDelay`値でエラーハンドリングが動作することをテスト

### プロパティベーステスト

- ランダムなメンバーリストと選出順序を生成し、円形ルーレットの各回で針位置が選出結果と一致することを検証
- ランダムなメンバーリストと選出メンバーを生成し、スロットマシンの全列が正常に回転・停止することを検証
- ランダムな`duration`と`columnDelay`の組み合わせを生成し、スロットマシンの停止順序が常に左から右であることを検証
- 多数のシナリオで、バグ条件に該当しない入力が修正前後で同じ動作を生成することを検証

### 統合テスト

- 複数人選出の完全なフローをテスト（円形ルーレットで3人を順番に選出）
- アニメーション方式の切り替えをテスト（円形ルーレット→スロットマシン→円形ルーレット）
- ユーザー設定の適用をテスト（カスタム`duration`、`minRotations`、`columnDelay`）
- 視覚的なフィードバックをテスト（アニメーション中の描画、停止時の最終位置）
