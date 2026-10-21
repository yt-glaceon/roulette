# 設計: ルーレット各方式のアニメーションを一般的な挙動に寄せる

- 日付: 2026-10-21
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-21-roulette-animation-behavior.md](../investigations/2026-10-21-roulette-animation-behavior.md)
- 承認者: yt-glaceon
- 承認日: 2026-10-21

## 目的・スコープ

4方式(円形ルーレット・スロットマシン・ドラムロール・カードめくり)の動きを、Web のルーレットツールでよく見る挙動に寄せる。どの方式でも「止まって見えた人 = 選出結果」は必ず守る。

### やること

- 円形: 前回止まった角度から回り始める。当選者の区画内のランダムな位置で止まる
- スロット: 絵柄が上から下へ流れる。一気に回り始め、一定速度で回ったあと左から順に減速して止まる。アニメーション時間の設定に従う
- ドラムロール: 減速の流れのまま当選者で止まる(最後に突然切り替わらない)。終了時刻を設定時間に合わせる
- カードめくり: 裏向きのカードの上を光が移動して減速し、止まったカードがめくれる。続けて残りのカードもめくれる。複数人選出時に前回の表示が残るバグを解消する
- 4方式共通: 複数人選出の2回目以降は、当選済みの人を盤面から外して回す
- 4方式共通: アニメーション時間の意味を「回り始めてから当選者が確定するまで」にそろえる
- 上記に合わせて既存テストを書き換え、新しい挙動のテストを追加する

### やらないこと(スコープ外)

- 効果音、針の跳ね返り、リール停止時のバウンス(調査で「Web ツール並み」と合意)
- `prefers-reduced-motion` への対応
- 抽選ロジック(`js/roulette-engine.js`)の変更。結果は今まで通りアニメーション前に確定する
- アニメーション選択 UI・時間スライダー・localStorage キーの変更(`card` などの保存値はそのまま使う)
- 演出部品の共通基底クラス化(調査の比較で不採用)
- `.kiro/specs/` の編集(過去仕様は残し、食い違う記述はこの設計で置き換える。下の「既存仕様との関係」参照)

## アーキテクチャ・変更概要

4つのアニメーションクラスの公開インターフェース `initialize(members)` / `spin(selectedMember, { duration })` / `destroy()` は維持し、**`updateMembers(members)` を4クラスすべてに追加**する。

### 共通の約束

- **duration の意味**: `spin` を呼んでから当選者が確定して見える(円形とスロットは止まる、ドラムは当選者が表示される、カードは光が当選カードで止まる)までが `duration`(誤差 ±100ms 程度)。確定後の短い演出(カードがめくれる、ドラムの強調)は `duration` の外で、合計 1 秒以内に収め、`spin` の Promise はその演出の終了後に resolve する。
- **当選者の除外**: 呼び出し側(`ui-controller.js`)が2回目以降の `spin` の前に `updateMembers(残りのメンバー)` を呼ぶ。アニメーションクラスは自分で当選者を外さない。
- **`updateMembers(members)`**: 盤面を渡されたメンバーで作り直す。見た目の連続性に関わる状態(円形の回転角、スロットの各列の位置)は引き継ぐ。`spin` 中に呼ばれることは想定しない。
- **残り1人の回**: 演出は省かず、1人だけの盤面で通常どおり回す。
- **後始末**: `destroy` は、そのインスタンスが走らせている `requestAnimationFrame`・`setTimeout` をすべて止める(円形・スロットは rAF、ドラム・カードは `setTimeout`)。`ui-controller` は再実行のたびにコンテナを消すので、古いインスタンスのコールバックが残らないようにする。`destroy` 後に待っている `spin` の Promise は resolve してよい(呼び出し側は待たない)。

### 新規: `js/animations/animation-timing.js`(純粋関数のみ、DOM に触れない)

jsdom では `requestAnimationFrame` の実時間や CSS transition の途中経過を検証しにくいため、時間配分と停止位置の計算はここに切り出して単体テストする。

| 関数 | 役割 |
| --- | --- |
| `easeOutCubic(p)` | `1 - (1 - p)^3`。円形・スロットの減速に使う |
| `buildDecelSchedule(duration, { minInterval, maxInterval, steps })` | 切り替え時刻の配列(長さ = 切り替え回数)を返す。ドラムロール・カードめくりが使う。仕様は下記 |
| `pickOffsetInSection(random, margin)` | 区画内の停止位置を 0〜1 の比率で返す。`margin + random() × (1 - 2 × margin)`。円形が使う |

`buildDecelSchedule` の仕様:

- j 番目(1 始まり、全 M 回)の間隔の形を `g(j) = minInterval + (maxInterval - minInterval) × (j / M)^2` とする。
- 時刻 `t_j = g(1) + … + g(j)` を、最後の `t_M` がちょうど `duration` になるよう全体に同じ係数を掛けて合わせる。最初の切り替えは t=0 ではなく1つ目の間隔のあと。
- `steps` 省略時: 係数を掛ける前の `t_M` が `duration` に最も近くなる M を選ぶ(1 以上)。このとき各間隔はおおむね `[minInterval, maxInterval]` に収まる。
- `steps` 指定時: M = `steps`。係数で間隔が上下限を外れてもよいが、最短の間隔は 20ms を下回らないこと。呼び出し側(ドラム)は 20ms を下回る M を指定しない(下記)。

### `js/animations/roulette-wheel.js`(円形)

- `spin` 先頭の `this.rotation = 0` を削除する。
- 目標角の計算を「現在角からの相対」にする。針は上(角度 `3π/2`、Canvas 座標で `-π/2`)に固定。区画 i は `rotation + w*i` から `rotation + w*(i+1)` を占める(`w = 2π / 人数`)。
  - 停止位置の比率 `f = pickOffsetInSection(Math.random, 0.15)`(区画幅の両端15%を避ける。30人で区画12度でも境界から約1.8度離れる)
  - `delta = normalize(3π/2 - (w*i + w*f) - normalize(rotation))`(0〜2π)
  - `targetRotation = rotation + 2π * extraRotations + delta`。`extraRotations` は今と同じ `minRotations + 0〜2`
- イージングは今の easeOutCubic を `animation-timing.js` 経由で使う。
- `calculateTargetAngle` は上の計算に置き換える。重複した JSDoc と崩れたインデントは整理する。
- `getPointerIndex` は「針がどの区画の中にあるか」で判定する方式に置き換える(区画内ランダム停止でも中央との距離方式と結果は同じだが、意図が明確になる)。
- `updateMembers(members)`: `members` を差し替え、`rotation` はそのまま再描画する。区画が減るので見た目は変わるが、次の `spin` は現在の回転角から始まる。

### `js/animations/slot-machine.js`(スロット)

CSS transition 1本の方式をやめ、`requestAnimationFrame` で各列の位置を毎フレーム計算する方式に変える。

**位置と表示の対応(式で固定する)**

- 列ごとに、シャッフル済みメンバー `order`(長さ n)と、連続値 `pos`(単位: アイテム1個分、初期値 0)を持つ。
- 中央行に来るメンバーは `order[mod(-pos, n)]`(`pos` が整数のとき)。`mod(a, n)` は 0 以上 n 未満に丸める剰余。
- リールの DOM は `order` を R 回繰り返して上から並べる(行番号 0, 1, 2, … の行には `order[行番号 mod n]`)。R = `2 + ceil(3 / n)`(n=1 なら 5、n=2 なら 4、n≥3 なら 3)。回転量を増やしても DOM は増えない。
- `q = mod(-pos, n)`(0 以上 n 未満の実数)とし、中央に来る行を `n + q` 行目とする。表示窓は3行なので先頭行は `n + q - 1` 行目。
  - `translateY = -(n + q - 1) × itemHeight`(px)
- `pos` が増えると `q` が減り、`translateY` が 0 に近づく = 絵柄が上から下へ流れる。`q` が 0 を下回って n 近くへ戻るとき `translateY` は n 行ぶん跳ぶが、R 回繰り返した同じ並びなので見た目はつながる。

**動き方(列 k = 0, 1, 2)**

- 停止時刻 `T_k = duration × (0.6, 0.8, 1.0)[k]`。最後の列が `duration` で止まる。
- 減速時間 `D_k = min(1200, T_k × 0.6)`(ms)。立ち上がり時間 `r_k = min(150, (T_k - D_k) × 0.25)`(ms。短い duration でも立ち上がりが減速開始を越えない)。
- 速度の形(V は定速区間の速度、アイテム/ms):
  - 0〜`r_k`: 速度は 0 から V へ直線的に上がる。この区間の移動量は `V × r_k / 2`
  - `r_k`〜`T_k - D_k`: 速度 V で一定
  - `T_k - D_k`〜`T_k`: 減速区間の開始からの**移動量**が `V × D_k / 3 × easeOutCubic(u)`(u は減速区間内の進み 0〜1)。速度は `V × (1 - u)^2` で、減速開始時に V と一致し、`T_k` で 0 になる。区間の移動量は `V × D_k / 3`
- 総移動量 `S = V × K`、`K = r_k / 2 + (T_k - D_k - r_k) + D_k / 3`。
- **着地の決め方**: 基準速度 `V0 = 15 アイテム/秒` で `S0 = V0 × K` を出し、`S ≥ S0` かつ `mod(pos0 + S, n) = mod(-w, n)`(w は当選者の `order` 内インデックス、pos0 は開始時の pos)を満たす最小の整数差 S を選ぶ。そのうえで `V = S / K` と逆算する。速度は列ごとに V0 以上、最大で `V0 + n / K` になる(30人・3秒設定の左列で約3倍)。`pos0` は常に整数(停止時は整数ちょうど、`updateMembers` でも丸める)で、`planReelMotion` 内でも念のため `Math.round` する。n=1 なら `S = ceil(S0)` で速度はほぼ V0。
- 停止時に `pos` を `pos0 + S` ちょうどに設定する。3列とも当選者で揃う。
- この計算はモジュール内の純粋関数として export する(例: `planReelMotion({ pos0, n, winnerIndex, stopTime, baseSpeed })` が `{ S, V, r, D, T }` を返し、`reelPositionAt(plan, t)` が時刻 t の pos を返す)。時間を引数で渡せるのでテストで直接検証できる。

**その他**

- **前回位置からの継続**: `spin` 開始時に `translateY(0)` へ戻さず、現在の `pos` から回し始める。
- `itemHeight` は初回描画後に `.slot-item` の実際の高さ(`offsetHeight`)を測り、0 のとき(jsdom)は 120 にフォールバックする。
- 中央行のメンバーを返す `getCenterMember(columnIndex)` を追加する(上の式で `pos` から求める)。
- `updateMembers(members)`: 各列の `order` とリール DOM を作り直し、`pos` は `mod(round(pos), 新しい n)` に丸めて引き継ぐ(見た目が多少ずれるのは許容)。
- `destroy` で走っている `requestAnimationFrame` を止める。

### `js/animations/drum-roll.js`(ドラムロール)

- 切り替え時刻を `buildDecelSchedule(duration, { minInterval: 50, maxInterval: 400 })` で事前に作る。切り替え回数を N とする。
- 開始時に表示中のメンバー(`currentIndex`)から順に1人ずつ切り替え、**最後の切り替えでちょうど当選者になる**ように切り替え回数を調整する。`(currentIndex + N') mod 人数 = 当選者のインデックス` を満たす N' のうち、N 以上で最小のものを選ぶ。それで最短間隔が 20ms を下回る場合は、N 未満で最大のもの(N - 人数 < N' < N)を選ぶ(N' が 1 未満になる場合は人数ぶん足す)。`buildDecelSchedule(duration, { ..., steps: N' })` で回数 N' のスケジュールを作り直す。開始時に別の人へ飛ばないので、切り替えの流れが途切れない。1人ずつ進むので、当選者が2回続けて表示されることはない(人数1人の場合を除く)。
- `currentIndex` の扱い: `spin` 開始時に `members[currentIndex]` を表示し直してから切り替えを始める。`updateMembers` では、表示中の人が新しい `members` に残っていればそのインデックスに、いなければ `min(currentIndex, 人数 - 1)` にする。
- 最後の切り替えが `duration` ちょうどに来るので、終了時刻が最大 0.5 秒遅れる問題がなくなる。
- 確定後の強調(拡大して戻す、今と同じ)は 400ms 程度で、その終了後に resolve する。
- 走っている `setTimeout` を保持し、`destroy` で確実に止める(今は未使用の `intervalId` があるだけ)。
- `updateMembers(members)`: `members` を差し替え、上の規則で `currentIndex` を直す。表示は次の `spin` 開始時に更新する。

### `js/animations/card-flip.js`(カードめくり)

- **カードの構造**: 各カードを「表(アバターと名前)」「裏(模様だけ)」の2面にし、CSS の `transform: rotateY(180deg)` と `backface-visibility: hidden` でめくる。初期状態はすべて裏向き。
- **光の移動**: `buildDecelSchedule(duration, { minInterval: 60, maxInterval: 450 })` の各時刻で、光るカードを1枚選ぶ。直前と同じカードは選ばない(2枚以上あるとき)。最後の時刻のカードを当選カードにする。最後から2番目のカードは当選カード以外から選ぶ。光るカードの順番は事前に一括で決め、偏った `sort(() => Math.random() - 0.5)` は使わない。
- **めくる**: 光が当選カードで止まったら(= `duration`)、当選カードをめくる(400ms)。その 300ms 後に残りのカードをまとめてめくり、半透明にする。合計約 1 秒の後に resolve する。
- **複数人選出**: 2回目の前に呼び出し側が `updateMembers(残り)` を呼ぶので、カードは当選済みを除いた全員分を裏向きで作り直す。これで前回の強調や半透明が残らない。`spin` 開始時にも念のため全カードを裏向き・強調なしの状態に戻す。
- 1人だけのときは光の移動を省かず、同じカードが点滅する形で `duration` まで続け、最後にめくる。

### `js/ui-controller.js`(呼び出し側)

- 選出人数分の `spin` ループで、2回目以降(i ≥ 1)の `spin` の前に、`selected.slice(0, i)` の **id** に含まれない人で `members` を filter し、`animation.updateMembers(remaining)` を呼ぶ(インデックスではなく id で比較する)。
- エラー時に円形へフォールバックするループにも同じ処理を入れる。
- それ以外(コンテナ作成、500ms の間隔、終了後のボタン表示)は変えない。

### `css/style.css`

- スロット: `.slot-reel` の `transform` 初期値はそのまま。transition は使わなくなるので JS 側で設定しない。
- カード: `.card-flip-item` に `perspective` と、表・裏の2面(`.card-flip-face` / `.card-flip-front` / `.card-flip-back` など)のスタイル、めくった状態(`.card-flip-flipped`)、光っている状態(既存の `.card-flip-highlight` を裏面向けに調整)を追加する。既存の `.card-flip-selected` / `.card-flip-unselected` は意味を保って表面に適用する。

### 既存仕様との関係

次の過去仕様の記述は、この設計で置き換える(`.kiro/specs/` 自体は編集しない)。

| 過去仕様 | 置き換え後 |
| --- | --- |
| `animation-result-mismatch-fix/bugfix.md` 2.2「rotation値がリセットされ、常に同じ初期位置から回転」 | 現在の回転角から相対で回し、針と結果の一致は相対計算で保証する |
| `animation-selector/requirements.md` スロット「各列の停止時間差: 1秒」 | 停止時刻は duration の 60% / 80% / 100% |
| `animation-selector/requirements.md` カード「全メンバーのアイコンをグリッド表示、ランダムに光る」 | 裏向きのカードの上を光が移動して減速し、止まったカードがめくれる |

### フロントエンド構成

新規ファイルは `js/animations/animation-timing.js` の1つだけで、既存の `js/animations/` に置く軽微な追加のため `frontend-designer` への委譲は行わない。DB 変更もない。

## 実装ステップ

`/loop-basic:implement` はこの順序で着手する。ステップ2〜6は、ステップ1の完了後に並列で進めてよい(下の担当表のとおり触るファイルが重ならない)。ステップ7はステップ2〜6がすべて終わってから行う。

| ステップ | 担当ファイル(このステップだけが編集する) |
| --- | --- |
| 1 | `js/animations/animation-timing.js`(新規)、`tests/unit/animation-timing.test.js`(新規) |
| 2 | `js/animations/roulette-wheel.js`、`tests/unit/roulette-wheel.test.js` |
| 3 | `js/animations/slot-machine.js`、`tests/unit/slot-machine.test.js`(新規) |
| 4 | `js/animations/drum-roll.js`、`tests/unit/drum-roll.test.js`(新規) |
| 5 | `js/animations/card-flip.js`、`css/style.css`、`tests/unit/card-flip.test.js`(新規) |
| 6 | `js/ui-controller.js`、`tests/unit/ui-controller.test.js` |
| 7 | `tests/unit/animation-bug-exploration.test.js`・`tests/unit/animation-preservation.test.js`(削除)、`docs/process/project-dev.md` |

既存の `animation-bug-exploration.test.js`・`animation-preservation.test.js` は円形とスロットの両方を含み、0リセット・1s/2s/3s・`animateColumn` のスパイを前提にしている。ステップ2・3ではこの2ファイルを編集せず、まだ有効な検証(針と結果の一致、最低回転数、duration、列が左から順に止まる)を新しい前提で各クラスのテストファイルに移す。ステップ2・3の作業中はこの2ファイルが失敗してよい(自分の担当テストファイルだけを実行して確認する)。ステップ7で、移し替えが済んでいることを確かめてから2ファイルを削除する。

- [x] ステップ1: `js/animations/animation-timing.js` を作る(`easeOutCubic`・`buildDecelSchedule`・`pickOffsetInSection`)。単体テスト `tests/unit/animation-timing.test.js` を書く
- [x] ステップ2: 円形 `roulette-wheel.js` を直す(相対の目標角、区画内ランダム停止、`getPointerIndex` の置き換え、`updateMembers`、`destroy` で rAF を止める、JSDoc とインデントの整理)。テストは `tests/unit/roulette-wheel.test.js` に追加し、既存2ファイルの円形の検証を新しい前提で移す
- [x] ステップ3: スロット `slot-machine.js` を直す(上記の式どおりの rAF 方式、`planReelMotion`/`reelPositionAt` の export、前回位置から継続、`getCenterMember`、`updateMembers`、`itemHeight` の実測、`destroy`)。テストは新規 `tests/unit/slot-machine.test.js` に書き、既存2ファイルのスロットの検証を新しい前提で移す
- [x] ステップ4: ドラムロール `drum-roll.js` を直す(減速スケジュール、切り替え回数 N' の調整、`currentIndex` の規則、タイマーの保持と `destroy`、`updateMembers`)。テスト: 新規 `tests/unit/drum-roll.test.js`
- [x] ステップ5: カードめくり `card-flip.js` と `css/style.css` のカード部分を直す(2面カード、光の移動と減速、めくり、状態のリセット、`updateMembers`、`destroy`)。テスト: 新規 `tests/unit/card-flip.test.js`
- [x] ステップ6: `ui-controller.js` の `spin` ループに `updateMembers` 呼び出しを入れる(通常ループとフォールバックの両方、id で filter)。テスト: `tests/unit/ui-controller.test.js` に追加。ステップ2〜5と並列で進めるため、テストではメソッドが無い場合に備えて `prototype.updateMembers` を `jest.fn()` で代入してから spy する(終了時に元へ戻す)
- [x] ステップ7: 既存2ファイルの検証が新しいテストに移っていることを確認して削除する。`npm test` と `npm run build` を通す。`docs/process/project-dev.md` の「構成」に `animation-timing.js` を追記する

## テスト戦略

**自動テストを新規作成するか:** する(理由: 今回の変更は「止まって見えた人 = 結果」に直結し、手動確認だけでは複数人選出・人数違いの組み合わせを網羅できない。既存テストも前提が変わるため書き換えが必要)

### 単体テスト(Jest + jsdom + fast-check、`tests/unit/`)

テストの書き分け:

- **実時間で `spin` を走らせるテスト**は `duration` を 20〜500ms にし、「最終的に表示された人 = 当選者」「状態のリセット」など結果だけを検証する。fast-check の `numRuns` は 10〜20、テストごとに `jest` の timeout(例: 30000ms)を指定する。
- **速度の形・時間配分**は、本番想定の duration(3000〜10000ms)を純粋関数に渡して検証する(短い duration では定速区間がなくなるため)。
- 乱数に依存する箇所は `Math.random` をスタブする(例: 0 / 0.5 / 0.999)。

- `animation-timing.test.js`
  - `buildDecelSchedule`(steps 省略): 時刻が単調増加、間隔が単調非減少、最後の時刻が `duration` に一致(誤差 1ms 以内)、各間隔が `[minInterval × 0.5, maxInterval × 1.5]` に入る(fast-check、duration 3000〜10000)
  - `buildDecelSchedule`(steps 指定): 長さが `steps`、最後の時刻が `duration`、間隔が単調非減少
  - `pickOffsetInSection`: `random` を 0 / 0.999 にしたとき、戻り値が `[margin, 1 - margin]` に入る(fast-check でも確認)
- `roulette-wheel.test.js`(追加。既存2ファイルの円形部分の移し先)
  - 1回目も2回目以降も、`spin` 後の `getPointerIndex()` が当選者のインデックスと一致する(fast-check、人数 1〜30、連続 1〜5 回)
  - 2回目の `spin` 開始時の回転角が、1回目終了時の回転角と同じ(0に戻らない)
  - 停止位置が区画の境界から区画幅の15%以上離れている
  - 最低回転数(`minRotations`)以上回っている
  - `updateMembers` 後も回転角が保たれ、次の `spin` 後に針が当選者を指す
- `slot-machine.test.js`(新規。既存2ファイルのスロット部分の移し先)
  - `planReelMotion`/`reelPositionAt`(純粋関数、duration 3000〜10000、人数 1〜30、fast-check):
    - `reelPositionAt(plan, T)` が `pos0 + S` に一致し、`mod(-(pos0 + S), n)` が当選者のインデックス
    - 時刻とともに pos が単調非減少(上から下へ流れる向き)
    - 定速区間 `[r, T - D]` では速度が V で一定、減速区間では速度が単調に下がり T で 0
    - `S ≥ S0`、`V ≤ V0 + n / K`
    - 列の停止時刻が duration の 60% / 80% / 100% で、左から順
  - 実時間の `spin`(短い duration、人数 1〜30):
    - 3列すべての `getCenterMember` が当選者
    - **DOM でも確認する**: 各列の `reel.style.transform` の px 値から中央行を `-translateY / itemHeight + 1` で求め、その行の `.slot-item` の名前が当選者と一致する(`getCenterMember` の自己参照にならないように)
  - 2回目の `spin` 開始時の pos が1回目終了時の pos と同じ
  - `updateMembers` 後の `spin` で当選者が中央に来る、外したメンバーがリールに無い
  - `destroy` 後に rAF のコールバックで DOM が更新されない
- `drum-roll.test.js`(新規)
  - `spin` 後の表示が当選者(人数 1〜30)
  - 最後の切り替えの直前に表示されていた人が当選者ではない(人数2以上)。開始時の人と当選者が同じ場合(N' が人数の倍数)と、人数2の場合を含める
  - 切り替えの順番が1人ずつ進む
  - 人数30・duration 3000 でも最短間隔が 20ms 以上
  - `updateMembers` で表示中の人が外れたとき、`currentIndex` が範囲内に収まり、次の `spin` 後に当選者が表示される
  - `destroy` 後にタイマーが走らない
- `card-flip.test.js`(新規)
  - 初期状態で全カードが裏向き
  - 光る順番の最後が当選カード、連続で同じカードが光らない(人数2以上)
  - `spin` 後、当選カードがめくれて `card-flip-selected`、他は `card-flip-unselected`
  - `updateMembers` 後、カードは当選済みを除いた人数で、すべて裏向き・強調なし
  - `destroy` 後にタイマーが走らない
- 円形でも `destroy` 後に rAF のコールバックで描画されないことを確認する
- `ui-controller.test.js`(追加。`animateRoulette` を直接呼ぶ)
  - 準備: 4クラスの prototype の `initialize`・`spin`・`updateMembers` を `jest.spyOn` で差し替える(ESM なので `jest.mock` より prototype の spy が確実)。`localStorage` に `roulette_animation_type` を入れて方式を選ぶ。`UIController.prototype.sleep` を即時 resolve に差し替える。`animateRoulette` が参照する DOM(`#roulette-screen` 相当の `.container`、メンバーリスト等)はテスト内で用意する
  - 5人中3人選出時、2回目・3回目の `spin` の前に、それまでの当選者の id を除いたメンバーで `updateMembers` が呼ばれる。1回目の前には呼ばれない
  - 1回目の `spin` が例外を投げたとき、フォールバックの円形でも2回目以降に `updateMembers` が呼ばれる
- 円形の追加テストでは、`Math.random` を 0 / 0.999 にスタブして停止位置が境界から区画幅の15%以上離れることを確認する(既存テストの `Math.random = () => 0.5` は中央停止になり、そのまま成立する)

### 手動確認(`npm run dev` → `http://localhost:5500/roulette/?mock`)

各方式で、プリセットの「通常(8人)」「大人数(30人)」「1人」と、8人から3人選出を確認する。

- 円形: 2回目以降に盤面が初期位置へ戻らない。区画の中央以外でも止まる。当選済みの区画が消える
- スロット: 絵柄が上から下へ流れる。左から順に止まる。スライダー3秒と10秒で全体の長さが変わる
- ドラムロール: 減速の流れのまま当選者で止まる
- カードめくり: 裏向きで並び、光が減速して止まったカードがめくれ、続いて残りもめくれる。2回目に前回の表示が残らない
- スマホ幅(375px)でスロットの止まる位置がずれない、カードがめくれる

### 合格基準

- `npm test` が全件成功、`npm run build` が成功
- 上記の手動確認で、どの方式でも止まって見えた人と結果画面の人が一致する

## リスク・トレードオフ

- **スロットを rAF 方式にすることで差分が大きくなる。** CSS transition では「定速→減速」を1本で表せないため、これ以外に一般的な挙動を出す手段が乏しい。位置計算を純粋関数にしてテストで担保する。
- **jsdom では実際の見た目(滑らかさ、カードの3D)は検証できない。** 手動確認で補う。
- **既存テストの書き換え**: 「0リセット」「列は 1s/2s/3s」「`animateColumn` のスパイ」を前提にした箇所は意味が変わる。書き換え時に「止まった位置 = 結果」の検証は必ず残し、弱めない。
- **大人数でのスロット**: 30人だと最高速度で一周しない列がある。止まる位置の一致には影響しないが、少ない回転量に見える可能性がある `[要検証]`(手動確認で見て、物足りなければ最高速度を上げる)。
- **カードめくりの所要時間**: 確定後に約1秒の演出が加わるため、複数人選出の全体時間は今より少し長くなる。
- **既存仕様との食い違い**: 上の表のとおり置き換える。過去仕様を読んだ人が混乱しないよう、この設計ドキュメントを参照先とする。

## ロールバック方針

変更はフロントエンドのみで、データや設定の形式は変えない(localStorage の値もそのまま)。問題が出たら、マージコミットを `git revert` する PR を作って main に反映すれば、GitHub Pages が前の版に戻る。方式単位の不具合なら、その方式のファイルだけ戻す修正 PR でもよい。

## 壁打ちの記録

- duration の意味: 「当選者が確定するまで」で確定(確定後の演出1秒以内は外に出す)
- スロットの停止時刻: duration の 60% / 80% / 100% で確定
- 残り1人の回: 演出を省かず通常どおり回すで確定
- ドラムロール: 下書きでは開始時に逆算した人へ一度飛ばしていたが、開始時の不連続になるため「切り替え回数 N' を調整する」方式に変更。`buildDecelSchedule` に `steps` を追加

## 設計レビュー結果

`design-reviewer` による自動レビュー(最大2ラウンド、`/design` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | MAJOR | ステップ2・3が既存テスト2ファイルを同時に編集して衝突する/スロットの停止位置と速度の式が未確定。ほか MINOR 7件(buildDecelSchedule の式、ドラムの N' と currentIndex、全方式の destroy、ui-controller のテスト方法、短い duration、境界ケース) |
| 2 | PASS | MINOR 3件(減速区間の位置と速度の書き分け、ステップ6のテストでの spy 対象の存在、pos0 が整数である前提)→ 反映済み |

未解決のMAJORが残った場合: なし

## コードレビュー結果

`code-reviewer` による自動レビュー(最大2ラウンド、`/implement` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | MINOR のみ。再実行・フォールバック時に古いインスタンスを destroy していない/ドラムの確定後の強調が rAF に上書きされ見えない/当選者が盤面にいないときの挙動が方式ごとに違う/円形の destroy テストが弱い → いずれも修正済み(破棄処理の追加、強調を rAF 内で適用、4方式とも例外で統一、テスト強化)。カードの長い名前のはみ出しの可能性 → テストの手動確認で見る |
| 2(ラウンド1がMAJORの場合のみ) | — | 実施せず |

未解決のMAJORが残った場合: なし

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 承認 | 設計レビュー2ラウンドPASS、未解決MAJORなしで提示 |
