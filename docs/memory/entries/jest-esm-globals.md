---
name: jest-esm-globals
type: pitfall
status: active
related_topics: [roulette-animation-behavior, ci-actions, drum-roll-test-flaky]
created: 2026-10-21
updated: 2026-10-22
---

このリポジトリの Jest は `node --experimental-vm-modules` の ESM 実行なので、`jest` がグローバルに無い。`jest.spyOn`・`jest.fn`・`jest.useFakeTimers` を使うテストでは `import { jest } from '@jest/globals'` を書く。`jest.mock` も ESM では効きにくいので、クラスの差し替えは prototype への `jest.spyOn` が確実。

fake timers は `Date.now` も偽装するので、時刻ベースのスケジュールは偽タイマーで進め(jsdom では途中に await をはさまないタイマーの連鎖なら同期の `jest.advanceTimersByTime`。非同期版は偽タイマー1件ごとに実時間で待つ。[[jsdom-fake-timers-async-real-time]])、`jest.getTimerCount()` で `destroy` 後にタイマーが残っていないことを確認できる。jsdom では `requestAnimationFrame` と `performance.now()` も使え、短い duration(20〜300ms)なら実時間で `spin` を回すテストも安定する。

**背景:** ルーレット演出の改修で、4つの実装担当が同じ問題(`jest is not defined`)に当たった([設計](../../designs/2026-10-21-roulette-animation-behavior.md))。

**適用範囲:** `tests/unit/` に spy・モック・fake timers を使うテストを書くとき。

**関連:** [[import-meta-env-in-jest]]
