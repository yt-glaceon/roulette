---
name: absolute-stacked-faces-height
type: pitfall
status: active
related_topics: [roulette-animation-behavior]
created: 2026-10-21
updated: 2026-10-21
---

表と裏など2面を重ねるために両方を `position: absolute; inset: 0` にすると、親の高さが内容に合わせて伸びなくなり、`min-height` で固定される。長い名前やアバターが枠からはみ出す。

片方の面を通常の流れに置いて高さを決め、もう片方だけ絶対配置で重ねる(または `display: grid` で同じセルに重ねる)。メンバー名を表示する UI を変えたら、モックのプリセット「長い名前・絵文字・アバター無し」(`?mock`)で必ず見る。

**背景:** カードめくりを2面構造にしたとき、長い名前のカードで内容がはみ出した([テスト](../../tests/2026-10-21-roulette-animation-behavior.md))。

**適用範囲:** `css/style.css` で要素を重ねるレイアウトを作るとき。

**関連:** [[same-tick-visual-state]]
