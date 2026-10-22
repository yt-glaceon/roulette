---
name: drum-roll-test-timeout-flaky
type: pitfall
status: active
related_topics: [readme-refresh]
created: 2026-10-22
updated: 2026-10-22
---

`tests/unit/drum-roll.test.js` が実行のたびに 1〜6 件失敗して `npm test` が通らないことがある。コードや文書を変えていなくても起きる(readme-refresh のテストで 6 回中 6 回、毎回 1〜6 件失敗)。

主な失敗は「最後の切り替えの直前は当選者ではなく、1人ずつ進む」の `Exceeded timeout of 5000 ms`(Jest 既定の 5 秒)。偽タイマーで人数 2/3/8/30 × 開始位置を回す処理が、この環境では 5 秒に収まらない。実時間で回るテスト(最大 6 秒台)も同じ環境では余裕が少なく、`getTimerCount()` や当選者表示の期待が外れる失敗が出る日もある。

対処: 文書だけ・演出と無関係な変更のトピックで `npm test` が drum-roll だけ落ちたら、まず `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drum-roll.test.js` を単体で複数回流して再現性を見る。テストを緩めたりスキップしたりせず、不合格または既知の不安定としてレポートに書き、別トピックで直す(テストごとのタイムアウト指定や重い反復の削減が候補)。

**適用範囲:** `tests/unit/drum-roll.test.js`(`jest.useFakeTimers()` の反復テストと実時間の fast-check テスト)。
