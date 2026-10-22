---
name: jest-esm-tests
description: このリポジトリの tests/unit/ に Jest のテストを書く・直すときに使う。Jest は node --experimental-vm-modules の ESM 実行なので jest がグローバルに無い。spy・モック・fake timers の書き方と、server/ の純粋関数をテストする形をまとめる。
---

# jest-esm-tests: ESM 実行の Jest でテストを書く

ルートの `npm test` は `node --experimental-vm-modules node_modules/jest/bin/jest.js` で、テストは ESM として動く。`jest.config.js` の `testMatch` は `**/tests/**/*.test.js`、テスト環境は jsdom。

## 手順

1. `describe`・`test`・`expect` はグローバルのまま使ってよい。
2. `jest.fn`・`jest.spyOn`・`jest.useFakeTimers` などを使うときは、`jest` がグローバルに無いので `import { jest } from '@jest/globals';` を書く(書かないと `jest is not defined`)。
3. モジュールの差し替えは `jest.mock` が ESM では効きにくい。クラスは prototype への `jest.spyOn` で差し替える。
4. fake timers は `Date.now` も偽装する。時刻ベースの処理は偽タイマーで進める。途中に await をはさまないタイマーの連鎖なら同期の `jest.advanceTimersByTime` を使う(jsdom では `advanceTimersByTimeAsync` が偽タイマー1件ごとに本物の `setTimeout` で待ち、Windows では 5 秒を超えることがある。`docs/memory/entries/jsdom-fake-timers-async-real-time.md`)。同期 advance のあとに Promise の `.then` の結果を見るときは `await Promise.resolve();` をはさむ。後片付けの確認に `jest.getTimerCount()` を使う。jsdom では `requestAnimationFrame` と `performance.now()` も使え、短い duration(20〜300ms)なら実時間で回しても安定する。
5. `import.meta.env` は Jest では undefined。env を参照するコードはエントリポイントに寄せ、ロジックを切り出してテストする(`docs/memory/entries/import-meta-env-in-jest.md`)。
6. `server/` のロジックは、副作用の無い純粋関数のモジュール(例: `server/log-safe.js`・`server/cors-origin.js`)に切り出し、`tests/unit/server-<name>.test.js` から `../../server/<name>.js` を import してテストする。`server/index.js` は import 時に Bot ログインと `app.listen` が走るのでテストから import しない。
7. プロパティテストは `fast-check` を default import する(`import fc from 'fast-check';`)。

## 書き方の前例

- `tests/unit/server-log-safe.test.js`(server/ の純粋関数 + fast-check、4スペースインデント)
- `tests/unit/drum-roll.test.js`(fake timers・spy)

## 元になった共有メモリ

`docs/memory/entries/jest-esm-globals.md`(roulette-animation-behavior・ci-actions・cors-exact-match・drum-roll-test-flaky で再利用)
