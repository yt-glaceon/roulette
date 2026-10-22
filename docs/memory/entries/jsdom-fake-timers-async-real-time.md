---
name: jsdom-fake-timers-async-real-time
type: pitfall
status: active
related_topics: [drum-roll-test-flaky]
created: 2026-10-22
updated: 2026-10-22
---

jsdom 環境の `jest.advanceTimersByTimeAsync` は、偽タイマーを1件発火させるたびに本物の `setTimeout` で1回待つ(jsdom の window に `setImmediate` が無いため)。Windows ではこの待ちが 1〜15ms と日によって変わるので、偽タイマーの多いテストはローカルだけ遅くなりタイムアウトする。途中に Promise をはさまないタイマーの連鎖なら、同期の `jest.advanceTimersByTime` で進める。

**背景:** drum-roll のテストがローカル Windows でだけ `Exceeded timeout of 5000 ms` になった。偽タイマー 100 件の非同期 advance は jsdom で約 1.6 秒、node 環境で約 3.5ms。タイムアウトしたテストの `for` ループは止まらず、`describe` 直下の `let` 変数を通して後続テストを汚し、無関係なテストまで落ちた。詳細は `docs/investigations/2026-10-22-drum-roll-test-flaky.md`。また偽タイマーは `Date`・`performance.now`・`process.hrtime` も偽物にするので、実時間を測るときは `process.hrtime.bigint` を `useFakeTimers` より前に退避して使う。

**適用範囲:** `testEnvironment: 'jsdom'` で `jest.useFakeTimers()` を使うテストを書く・直すとき。1 件のタイムアウトのあとに無関係なテストが連鎖して落ちているときは、まず最初のタイムアウトを疑う。

**関連:** [[drum-roll-test-timeout-flaky]](superseded)
