---
name: same-tick-visual-state
type: pitfall
status: active
related_topics: [roulette-animation-behavior]
created: 2026-10-21
updated: 2026-10-21
---

同じ時刻(同じ tick)に「見た目の状態を付ける」処理と「その状態を外す/上書きする」処理を予約すると、間にブラウザの描画が入らず、付けた状態は1フレームも表示されない。単体テストは状態の順番やクラスの付け外しを見るだけなので通ってしまう。

演出の「確定の瞬間」を見せたいとき(光が当選者で止まる、強調して戻す等)は、次の処理を数百 ms ずらすか、`requestAnimationFrame` の後に適用する。テストでは「確定時刻の直後に、確定を示す状態が付いていること」を時間を進めて確認する。

**背景:** カードめくりで最後の光とめくりを同じ時刻に予約し、光が当選カードで止まって見えなかった。ドラムロールでも強調の `scale(1.1)` が rAF の `scale(1)` に上書きされていた([テスト](../../tests/2026-10-21-roulette-animation-behavior.md))。

**適用範囲:** `js/animations/` の演出で、setTimeout・rAF・CSS transition を組み合わせるとき。

**関連:** [[absolute-stacked-faces-height]]
