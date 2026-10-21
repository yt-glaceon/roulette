# テストレポート: ルーレット各方式のアニメーションを一般的な挙動に寄せる

- 日付: 2026-10-21
- ステータス: 再テスト(2回目)完了
- 対応する設計ドキュメント: [docs/designs/2026-10-21-roulette-animation-behavior.md](../designs/2026-10-21-roulette-animation-behavior.md)

## テスト対象

設計の実装ステップ1〜7 すべて。

- `js/animations/animation-timing.js`(新規)、`roulette-wheel.js`・`slot-machine.js`・`drum-roll.js`・`card-flip.js`
- `js/ui-controller.js`(2回目以降の `updateMembers`)、`css/style.css`(カードの2面構造)
- `tests/unit/` の新規・書き換え、`docs/process/project-dev.md`

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test`: 12 スイート・144 件 | pass |
| ビルド | `npm run build` | pass |
| ビルド検査 | `grep -rlE '【モック】\|mock-badge' dist --include='*.js' --include='*.html'` が 0 件。`dist/assets` は `index-*.js`・`.map`・`.css` のみで mock を含むファイル無し | pass |
| 型チェック/Lint | 未構成 | 対象外 |
| 手動確認: 円形(8人・30人・1人・8人から3人・30人から5人連続・375px) | 針の指す人 = 結果画面の人。2回目以降の開始角 = 前回の終了角。区画内ランダム停止 | pass |
| 手動確認: スロット(同上 + 10秒設定) | 絵柄は上から下へ(逆走 0 フレーム)。停止は 60/80/100%。中央行の DOM の人 = 結果 | pass |
| 手動確認: ドラムロール(同上 + 10秒設定) | 間隔が滑らかに伸びて最後に当選者で止まる。最後の切り替え ≒ duration | pass |
| 手動確認: カードめくり(同上) | 裏向き → 当選カードがめくれる → 残りがめくれる。前回の表示は残らない。ただし下記の不具合2件 | **fail** |
| 手動確認(エッジケース): 長い名前プリセットでのカード | 長い名前のカードで表面の内容がカードからはみ出す | **fail** |

全 17 構成(4方式 × 通常8人 / 8人から3人 / 30人から2人 / 1人 / 375px 幅 + 長い名前 2 + スロット10秒・ドラム10秒・円形5連続)で、アニメーションが止まった人(各方式の確定表示)と結果画面の人が一致した。コンソールエラーは favicon の 404 のみ(今回の変更と無関係)。

## 証跡(手動確認分)

Playwright 1.48.2(Microsoft Edge、`channel: 'msedge'`)で `http://localhost:5500/roulette/?mock` を操作。`window` から各クラスの `prototype.spin` をラップし、毎フレームの値と各 `spin` の開始・終了時の状態を記録した(スクリプト・生データはスクラッチパッドにあり、リポジトリには含めない)。以下の数値は duration 3000ms(特記以外)の実測。

スクリーンショットは [docs/tests/assets/2026-10-21-roulette-animation-behavior/](assets/2026-10-21-roulette-animation-behavior/)(`<方式>-<構成>-mid|stop|end|result.jpg`。mid = 開始 50%、stop = 確定直後、end = 全選出の終了時、result = 結果画面)。

### 円形

- 2回目以降の `spin` 開始直後の回転角が前回終了時と一致(連続)。8人から3人: 0 → 35.958 → 82.537 → 118.392 rad。各 `spin` の開始角 = 前回の終了角(例: 33.913 = 33.913、67.859 = 67.859)。
- 30人から5人連続でも同じ(39.417、83.671、122.001、171.025 rad が前回終了角と一致)。針の指す人 = 当選者 = 結果画面(ことは/つむぎ/いつき/なぎさ/さくら2)。
- 区画内の停止位置(0 = 区画の始め、1 = 終わり): 0.16、0.24、0.28、0.30、0.32、0.33、0.40、0.52、0.57、0.65、0.69、0.82、0.83、0.84 など。区画の中央以外で止まり、15〜85% の範囲内。30人でも 0.16 で境界には触れない。回転量は 5.40〜7.83 周。
- 当選済みの区画が消える: [wheel-normal8x3-end.jpg](assets/2026-10-21-roulette-animation-behavior/wheel-normal8x3-end.jpg)(3回目、6区画)
- 画像: [wheel-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/wheel-normal8-mid.jpg)、[wheel-large30-end.jpg](assets/2026-10-21-roulette-animation-behavior/wheel-large30-end.jpg)、[wheel-mobile375-end.jpg](assets/2026-10-21-roulette-animation-behavior/wheel-mobile375-end.jpg)

### スロット

- 各列の `translateY` を毎フレーム記録。値が減る方向(下から上へ)のフレームはラップを除いて 0、増える方向のみ(上から下へ流れる)。
- 列ごとの停止時刻(最後に値が変わった時刻 / duration):
  - 通常8人 3秒: 1786 / 2387 / 2984 ms(0.60 / 0.80 / 0.99)
  - 30人 3秒: 1788 / 2385 / 2989 ms(0.60 / 0.79 / 1.00)
  - 10秒設定: 5994 / 7984 / 9986 ms(0.60 / 0.80 / 1.00)
  - 1人: 1801 / 2401 / 3002 ms
- 速度(アイテム/秒、左列): 開始 50ms で 0〜6.7、200ms で 16〜22 に立ち上がり、定速のあと、右列は終了 500ms 前 2.8 → 200ms 前 0.5 → 50ms 前 0.0 と減速して止まる(10秒設定では定速 15 アイテム/秒)。
- 3列とも、DOM の `translateY` から求めた中央行の名前 = 当選者 = 結果画面。
- 2回目の開始位置 = 前回の終了位置(人数が減った分は `mod 新しい人数` で丸めた値。例: [22, 29, 34] → 7人で [1, 1, 6]、58 → 29人で 0)。
- 画像: [slot-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/slot-normal8-mid.jpg)、[slot-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/slot-normal8-stop.jpg)、[slot-large30-end.jpg](assets/2026-10-21-roulette-animation-behavior/slot-large30-end.jpg)、[slot-mobile375-end.jpg](assets/2026-10-21-roulette-animation-behavior/slot-mobile375-end.jpg)(375px。3列が縦に並び、止まる位置のずれ無し)、[slot-normal8-10s-end.jpg](assets/2026-10-21-roulette-animation-behavior/slot-normal8-10s-end.jpg)

### ドラムロール

- 表示された名前の切り替え(MutationObserver)。最後の切り替え時刻は 3001〜3003ms(10秒設定: 10003ms)、`spin` の resolve は +約 400ms(確定後の強調)。
- 切り替えの間隔: 3秒・8人で 38 → 39 → 43 → 45 ms …(最後の 4 回)236 → 255 → 277 → 300 ms。30人でも最短 19〜26ms。10秒設定は 50ms から 394ms まで。減速しながら最後に当選者で止まる。
- 最後の 4 回の表示(例): `そうた → ひなた → れん → あおい`(最後が当選者あおい、直前は別人)。通常8人 3選出と 30人 2選出の全 spin で「最後 = 当選者、直前 = 別人」。1人のときは同じ人が続く(設計どおり)。
- 画像: [drum-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/drum-normal8-stop.jpg)、[drum-large30-stop.jpg](assets/2026-10-21-roulette-animation-behavior/drum-large30-stop.jpg)

### カードめくり

- 全 spin で初期状態は全カード裏向き(強調なし)。2回目以降も当選済みを除いた枚数(8→7→6、30→29)で裏向きから始まり、前回の表示は残らない。
- 当選カードがめくれる時刻 = duration + 3〜6ms(3003〜3006ms)。残りがめくれるのは約 300ms 後(3301〜3305ms)。resolve は 4000〜4002ms(確定後の演出は約 1 秒)。最終状態は当選カードのみ `selected`、他は `unselected`、結果画面と一致。
- 光は 14 回移動し、間隔は 60ms から 440ms 程度まで広がる(減速)。同じカードが連続で光ることは無い。
- **不具合1(下記)**: 光が当選カードで止まって見える瞬間が無い。
- **不具合2(下記)**: 長い名前のカードで表面がはみ出す。
- 画像: [card-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/card-normal8-mid.jpg)、[card-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/card-normal8-stop.jpg)、[card-normal8x3-end.jpg](assets/2026-10-21-roulette-animation-behavior/card-normal8x3-end.jpg)、[full-card-normal8-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/full-card-normal8-desktop.jpg)、[full-card-edge-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/full-card-edge-desktop.jpg)(はみ出し)、[full-card-edge-mobile375.jpg](assets/2026-10-21-roulette-animation-behavior/full-card-edge-mobile375.jpg)

### 数値ログ(card-normal8 の光とめくりの時系列、勝者はインデックス1)

```
63 ms 光=4 / 134 ms 光=1 / 204 ms 光=5 / 292 ms 光=1 / 392 ms 光=5 / 513 ms 光=6 / 655 ms 光=2 / 826 ms 光=6 /
1022 ms 光=1 / 1251 ms 光=0 / 1518 ms 光=2 / 1819 ms 光=7 / 2169 ms 光=1 / 2561 ms 光=4 (3003 ms まで約 440ms 点灯) /
3003 ms カード1がめくれる(光なし) / 3303 ms 残り全部がめくれる
```

## 不合格・不具合の詳細

### 不具合1(重要): カードの光が当選カードで止まらず、別のカードが光ったまま当選カードがめくれる

- 再現: カードめくり(どの人数・時間でも)。例: `localStorage` の方式を `card` にし、通常(8人)で 1 人選出。
- 期待: 設計「裏向きのカードの上を光が移動して減速し、止まったカードがめくれる」。止まって見えたカード = めくれるカード = 結果。
- 実際: 光の最後の 1 回(当選カードに移る時刻 = duration)と当選カードのめくり(同じ duration)が同じ瞬間に起きる。`card-flip.js` の `spin` では、最後の光を付けた同じ tick で `card-flip-highlight` を外して `card-flip-flipped` を付けるため、当選カードが光って見えるフレームが存在しない。直前の光(最終から 2 番目)のカードが約 440ms 点灯したまま止まって見え、そのあと別のカードがめくれる。
- 実測: 光が見えた最後のカードと当選カードが違った回数は、複数枚のカードがある 11 spin 中 11 回(8人・30人・6人のカードで一致)。上の時系列では光が見えた最後のカードはインデックス4、当選はインデックス1。
- これは設計の最優先ルール(「止まって見えた人 = 選出結果」)に反して見える。設計の文言(最後の時刻のカードを当選カードにし、duration でめくる)には沿っているため、設計の見直しか実装の修正が必要。方針案: 最後の光を当選カードに付けて、めくりを少し遅らせる(duration の外の確定後演出に含める)。
- 単体テストでは光の順番(`buildHighlightSequence`)しか見ていないため検出できなかった。

### 不具合2: 長い名前のカードで表面がカードからはみ出す(コードレビュー MINOR の持ち越し事項)

- 再現: `?mock` → 【モック】長い名前・絵文字・アバター無し → カードめくり(375px・1000px のどちらも)。
- 期待: 長い名前でも表面がカードの枠に収まる(変更前は内容に合わせてカードの高さが伸びていた)。
- 実際: 表と裏を `position: absolute; inset: 0` で重ねたため、カードの高さが `min-height`(150px / 375px では 130px)で固定される。当選カード(`card-flip-selected`)の表面は内容が枠より高くなる(`scrollHeight` 185px に対し `clientHeight` 146px)。アバターがカードの上に飛び出し、名前が下にはみ出す([full-card-edge-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/full-card-edge-desktop.jpg))。64文字の英数字の名前も同様(162px / 146px)。
- 変更前(main の同じ操作)ではカードの高さが 275px まで伸びて収まっていたため、今回の変更による退行。

### 参考(今回の変更による退行ではない)

- カードめくりは 375px 幅で横スクロールが出る(`scrollWidth` 664px > 375px)。main でも同じ値(664px)で、グリッドがコンテナ(`flex-direction: column; align-items: center`)の中で内容幅に伸びるため。今回は対象外。

## 未検証の観点・既知の制限事項

- 効果音・針の跳ね返り・バウンス・`prefers-reduced-motion` は設計のスコープ外。
- 動きの滑らかさ・カードの 3D の見え方は、静止画と数値でしか確認していない(人間の目での確認はゲートで行う)。mid/stop の画像で見える範囲では、めくりの途中(3302ms 付近)で他のカードが傾いて見える。
- スロットの「物足りなさ」(設計のリスク `[要検証]`): 30人・3秒では左列が約 9.6〜14 アイテム/秒、右列が約 27 アイテム/秒で、最高速度でも 1 周しない列がある(総移動量は 30人で 18〜58 アイテム)。画面上は流れて止まるが、人によっては少なく感じるかもしれない。設計の方針(物足りなければ最高速度を上げる)は未判断。
- 円形の 30人 3秒でも停止位置の比率は 0.16 まで下がる(15% の下限どおり)。区画が 12 度と狭いため、見た目では境界に近い。
- 実 API(`?token`)での確認はしていない(モックのみ)。
- 時間の計測は headless の Edge の rAF/タイマー。実機の負荷で ±数十 ms ずれる可能性がある。

## コードレビューからの引き継ぎ

なし(ラウンド1 PASS、MINOR は対応済み。「カードの長い名前のはみ出しの可能性」は手動確認で見る事項として引き継ぎ、上の不具合2として確認した)

## 総合判定

不合格

理由: 円形・スロット・ドラムロールは合格基準(止まって見えた人 = 結果画面の人、設計の動きの形)を満たした。カードめくりは、結果は正しいが、光が当選カードで止まって見えず(不具合1)、長い名前のカードがはみ出す(不具合2)。不具合1は設計の合格基準「止まって見えた人と結果画面の人が一致する」に反するため、不合格とする。`implementer` による修正のあと、カードめくりの再確認が必要。

## 再テスト(2回目)

- 日付: 2026-10-21
- 対象: 修正コミット d910a2d(`js/animations/card-flip.js`・`css/style.css`・`tests/unit/card-flip.test.js`)。光を duration で当選カードに移して止め、約400ms 後に当選カードをめくる。カードの表裏を grid で同じセルに重ね、高さを内容に合わせて伸ばす。
- 前回の結果(上の各節・総合判定)は初回テストの記録として残す。今回の判定は末尾の「総合判定(再テスト 2回目)」。

### 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test`: 12 スイート・145 件(前回 144 件、修正で 1 件追加) | pass |
| ビルド | `npm run build` | pass |
| ビルド検査 | `grep -rlE '【モック】|mock-badge' dist --include='*.js' --include='*.html'` が 0 件。`dist/assets` は `index-*.js`・`.map`・`.css` のみ | pass |
| 型チェック/Lint | 未構成 | 対象外 |
| 手動確認: カードめくり 不具合1(8人・8人から3人・30人から2人・1人・375px・長い名前2構成) | 最後に見えた光のカード = 当選カード。全 spin で一致 | pass |
| 手動確認: カードめくり 不具合2(長い名前、デスクトップ・375px) | はみ出し無し、アバター正円、めくり後に裏面は見えない | pass |
| 手動確認: 止まった人 = 結果画面の人(カード全構成) | 全 spin で一致 | pass |
| 手動確認: 回帰(円形・スロット・ドラム 各 通常8人 1選出) | 止まった人 = 結果画面の人。前回と同じ挙動 | pass |

### 証跡(再テスト)

前回と同じ方法(Playwright 1.48.2・Edge・`?mock`・各クラスの `prototype.spin` ラップと毎フレームのクラス記録)。duration 3000ms。スクリプトと生データはスクラッチパッド(`run2.js`・`an2.js`・`full2.js`、`results2/`)でリポジトリには含めない。スクリーンショットは `retest-` で始まる jpg(`<方式>-<構成>-mid|stop|end|result`)。

#### 不具合1: 光が当選カードで止まる

card-normal8 の時系列(勝者はインデックス4。H = 光、F = めくれた、S = 当選、U = 残り):

```
63ms 光=4 / 130ms 光=5 / 205ms 光=2 / 292ms 光=4 / 392ms 光=3 / 513ms 光=6 / 655ms 光=7 / 822ms 光=2 /
1022ms 光=1 / 1252ms 光=0 / 1514ms 光=5 / 1819ms 光=1 / 2170ms 光=5 / 2561ms 光=0 /
3004ms 光=4(当選カード。直前までの光=0 は消える) / 3404ms カード4がめくれる(FS) / 3704ms 残りがめくれる(FU) / resolve 4102ms
```

全構成の「最後の光のカード = 当選カード」(複数枚の spin。1人は下に別記):

| 構成 | spin | 最後の光 | 当選 | 最後の光の時刻 | 当選めくり | 残りめくり | resolve |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 通常8人 1選出 | 1 | idx4 | idx4 | 3004 | 3404 | 3704 | 4102 |
| 通常8人 3選出 | 1 | idx7 | idx7 | 3004 | 3404 | 3704 | 4102 |
| 通常8人 3選出 | 2(7枚) | idx3 | idx3 | 3004 | 3404 | 3705 | 4101 |
| 通常8人 3選出 | 3(6枚) | idx0 | idx0 | 3003 | 3403 | 3703 | 4100 |
| 大人数30人 2選出 | 1 | idx14 | idx14 | 3003 | 3403 | 3703 | 4101 |
| 大人数30人 2選出 | 2(29枚) | idx5 | idx5 | 3004 | 3404 | 3705 | 4100 |
| 375px 通常8人 2選出 | 1 | idx6 | idx6 | 3004 | 3404 | 3704 | 4101 |
| 375px 通常8人 2選出 | 2(7枚) | idx3 | idx3 | 3003 | 3402 | 3702 | 4100 |
| 長い名前 2選出 | 1(6枚) | idx0 | idx0 | 3004 | 3404 | 3704 | 4101 |
| 長い名前 2選出 | 2(5枚) | idx2 | idx2 | 3002 | 3402 | 3702 | 4101 |
| 長い名前 375px | 1(6枚) | idx0 | idx0 | 3004 | 3404 | 3704 | 4102 |

- 複数枚の 11 spin 中 11 回で一致(前回は 0 回一致)。直前の光は別のカード(最終から 2 番目が当選と同じになることは無し)。
- 光の最後の移動 = duration + 2〜4ms、当選めくり = duration + 約 400ms、残りのめくり = 当選めくり + 約 300ms、resolve = duration + 約 1100ms(設計のコメントどおり)。
- 光の移動回数は 15 回(前回 14 回 + 当選カードへの最後の移動)。同じカードが連続で光ることは無し。2回目以降も全カード裏向きの初期状態から始まる。
- 1人(card-single1): 光は 63ms にそのカードに付いたまま、3404ms にめくれる(`FS`)。確定後の見え方は他と同じ。
- 最終状態は当選カードのみ `S`、他は `U`。`selected` の名前 = 結果画面の名前。

#### 不具合2: 長い名前のカード(1000px・375px)

DOM の実測(めくり完了後、`.card-flip-front` の `scrollHeight`・`clientHeight`。画像は [retest-full-card-edge-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-edge-desktop.jpg)、[retest-full-card-edge-mobile375.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-edge-mobile375.jpg)、[retest-full-card-edge-desktop-x3.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-edge-desktop-x3.jpg)):

| 構成 | カードの高さ | 表面の scrollHeight / clientHeight(最大) | 横方向のはみ出し | アバター(幅×高さ。拡縮込み) | 裏面が見える枚数 |
| --- | --- | --- | --- | --- | --- |
| 長い名前 1000px・1選出 | 275〜318px | 285 / 285 | 無し | 76×76、88×88 | 0 / 6 |
| 長い名前 1000px・3選出(最後の 4 枚) | 275〜318px | 285 / 285 | 無し | 76×76、88×88 | 0 / 4 |
| 長い名前 375px・1選出 | 227〜263px | 235 / 235 | 無し | 57×57、66×66 | 0 / 6 |
| 通常8人 1000px(参考) | 143〜166px | 147 / 147 | 無し | 76×76、88×88 | 0 / 8 |
| 通常8人 375px(参考) | 124〜143px | 126 / 126 | 無し | 57×57、66×66 | 0 / 8 |

- 全カードで `scrollHeight ≤ clientHeight`(前回は 185 > 146)。カードの高さが内容に合わせて伸びる(前回は 150px / 130px に固定)。
- アバターは全カードで幅 = 高さ(正円)。76 や 88 は選出済み・当選カードの scale(0.95・1.1)込みの値で、アバター本来の 80×80 に対応する。
- 裏面: めくり後の各カード中心の `elementFromPoint` が裏面(`.card-flip-back`)に当たった枚数は 0。1000px では全カードの最上面が表面。375px では画面外(下)にあるカードは `elementFromPoint` が取れないので、取れた 3 枚はすべて表面で、残りは裏面でないことまで(取れない分は裏面判定が 0 のため)。
- スクリーンショットでも、長い名前・絵文字・記号・英数字 64 文字のカードで内容が枠に収まり、当選カード(緑)の高さも揃っている([retest-full-card-edge-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-edge-desktop.jpg))。

#### 止まった人 = 結果画面の人

- カード 全 7 構成(通常8人、8人から3人、30人から2人、1人、375px、長い名前 2 構成)で、`selected` のカードの名前 = 結果画面の名前(一致 true)。
- 回帰の 3 方式も一致: 円形はポインタの指す人 = ひなた = 結果、スロットは 3 列の中央行 = れん = 結果、ドラムは最後に表示された人 = あおい = 結果(直前は別人)。

#### 他の3方式の回帰確認(通常8人 1選出)

- 円形: 回転量 7.90 周、停止は区画の 0.82。前回の範囲内(区画内ランダム停止)。画像: [retest-wheel-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/retest-wheel-normal8-mid.jpg)、[retest-wheel-normal8-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-wheel-normal8-end.jpg)
- スロット: 停止 1795 / 2383 / 2984ms(0.60 / 0.79 / 0.99)。逆走 0 フレーム。右列の速度は終了 500ms 前 2.9 → 200ms 前 0.5 → 50ms 前 0.0 アイテム/秒。前回と同じ。画像: [retest-slot-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/retest-slot-normal8-mid.jpg)、[retest-slot-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-slot-normal8-stop.jpg)
- ドラム: 最後の切り替え 3002ms、最後の間隔 228 → 248 → 267 → 288ms。最後の 4 回は そうた → ひなた → れん → あおい。前回と同じ。画像: [retest-drum-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-drum-normal8-stop.jpg)
- コンソールエラーは favicon の 404 が円形の 1 件のみ(今回の変更と無関係。前回と同じ)。

#### 画像一覧(カード)

[retest-card-normal8-mid.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-normal8-mid.jpg)(光の移動中)、[retest-card-normal8-stop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-normal8-stop.jpg)(確定直後。当選カードがめくれている)、[retest-card-normal8x3-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-normal8x3-end.jpg)、[retest-card-large30-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-large30-end.jpg)、[retest-card-single1-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-single1-end.jpg)、[retest-card-mobile375-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-mobile375-end.jpg)、[retest-card-edge-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-edge-end.jpg)、[retest-card-edge-mobile375-end.jpg](assets/2026-10-21-roulette-animation-behavior/retest-card-edge-mobile375-end.jpg)、[retest-full-card-normal8-desktop.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-normal8-desktop.jpg)、[retest-full-card-normal8-mobile375.jpg](assets/2026-10-21-roulette-animation-behavior/retest-full-card-normal8-mobile375.jpg)。結果画面は `retest-card-*-result.jpg`。

### 未検証の観点・既知の制限事項(再テスト)

- 「光が当選カードに付いて約 400ms 止まって見えるか」は数値(クラスの付与時刻)で確認した。人間の目での見え方(400ms が十分に止まって見えるか、めくりの 3D の見え方)はゲートで確認する。
- 375px 幅のカードめくりの横スクロール(`scrollWidth` 664px)は前回と同じ値で、main でも同じ(今回の変更による退行ではない)。1000px でも `scrollWidth` が 1010px になるのは、当選カードの scale(1.1)によるものと見られるが、main との比較はしていない。
- 他の観点(円形・スロット・ドラムの詳細、30人のスロットの物足りなさ、実 API での確認)は前回の記載のとおり。今回の回帰確認は 3 方式とも 1 構成のみ。
- 時間の計測は headless の Edge の rAF/タイマー。実機の負荷で ±数十 ms ずれる可能性がある。

### 総合判定(再テスト 2回目)

合格

理由: 前回不合格の原因だった 2 件がどちらも解消した。不具合1: 複数枚のカードがある 11 spin すべてで、最後に見えた光のカード = 当選カード(前回は 0/11)。光は duration 直後に当選カードに付き、約 400ms 後にめくれ、約 300ms 後に残りがめくれる。不具合2: 長い名前のカードは 1000px・375px のどちらでも内容が枠に収まり、アバターは正円で、めくり後に裏面は見えない。止まった人 = 結果画面の人は全構成で一致し、他の 3 方式に回帰は無い。`npm test`(145 件)・`npm run build`・本番ビルドにモックが含まれないことの確認はすべて通った。

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 修正依頼 | カードめくりの不具合2件(光が当選カードで止まって見えない、長い名前のはみ出し)を修正して再テストする |
