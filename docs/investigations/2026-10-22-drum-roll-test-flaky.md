# 調査: drum-roll のテストがローカル Windows で不安定に失敗する

- 日付: 2026-10-22
- ステータス: 完了
- 関連する設計ドキュメント: [2026-10-22-drum-roll-test-flaky.md](../designs/2026-10-22-drum-roll-test-flaky.md)

## 背景・目的

readme-refresh(Markdown のみの変更)のテスト中に、コード差分が無いのに `tests/unit/drum-roll.test.js` が `npm test` でほぼ毎回 1〜6 件失敗した(共有メモリ [drum-roll-test-timeout-flaky](../memory/entries/drum-roll-test-timeout-flaky.md))。同じコードで当日の午前中は全件通り、main の CI(Linux)も成功している。テストを緩めたりスキップしたりせずに、環境の負荷に左右されないテストにするため、原因を調べる。

## 現状の把握

### 再現

ワークツリー作成前の main(8ee5fcb)で `node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/drum-roll.test.js` を 3 回流すと、6 / 10 / 2 件失敗した(20 件中)。件数が 20 なのは、後述のとおり別トピックのワークツリーにある同じテストも拾っているため。

失敗の内訳(1 回分):

| テスト | 結果 |
| --- | --- |
| spin 後の表示が当選者(実時間) | 通過(6116 ms) |
| 最後の切り替えの直前は当選者ではなく… | `Exceeded timeout of 5000 ms` |
| N が人数の倍数になる場合… | 期待した当選者と違う |
| 1人だけでも… | `Member1` が表示される(1人しかいないのに) |
| 人数30・duration 3000… | 間隔が 0ms |
| updateMembers: 表示中の人が外れたとき… | 期待した当選者と違う |
| 確定後の強調… | `scale(1.1)` が一度も出ない(3377 ms) |
| destroy 後に… | (この回は通過。別の回で `getTimerCount()` が 0 でない) |

### 原因1(根本): jsdom 環境の `advanceTimersByTimeAsync` は偽タイマー1件ごとに実時間で待つ

Jest 29.7 の偽タイマーは `@sinonjs/fake-timers` 10.3.0 を使う。非同期版の `tickAsync`(`jest.advanceTimersByTimeAsync`)は、偽タイマーを1件発火させるたびに `originalSetTimeout(nextPromiseTick)` で本物のタイマーに1回譲る。ここで `originalSetTimeout = _global.setImmediate || _global.setTimeout`(`node_modules/@sinonjs/fake-timers/src/fake-timers-src.js:1034`)となっており、`_global` は jsdom の window。jsdom の window には `setImmediate` が無いので、**本物の `setTimeout`(最短 1ms、Windows ではシステムのタイマー分解能しだいで約 1〜15.6ms)** に落ちる。

計測(偽タイマー 100 件を `advanceTimersByTimeAsync(2000)` で進めるのにかかった実時間。偽タイマーは `performance.now`・`process.hrtime` も偽物にするので、`process.hrtime.bigint` を事前に退避して測った):

| 環境 | 実 `setTimeout(0)` 1回 | 偽タイマー100件の非同期 advance |
| --- | --- | --- |
| testEnvironment: jsdom | 9.33 ms | 1568.9 ms |
| testEnvironment: node | 14.92 ms | 3.5 ms(`setImmediate` を使うため) |

同じ PC でも、実 `setTimeout(0)` は計測のたびに 1.2ms〜15ms と大きく変わった。Windows のタイマー分解能は、ほかのアプリ(ブラウザの動画再生など)が高分解能タイマーを要求しているかで変わるため、「午前中は通った」「Linux の CI では通る」と整合する。

「最後の切り替えの直前は…」は 24 回(人数 4 種 × 開始 2 種 × 当選者 3 種)spin し、1 回あたり切り替えのタイマーと各切り替えの `requestAnimationFrame`(偽タイマーでは 16ms 刻みのタイマー)で数十件の偽タイマーを発火させる。1件あたり約 10〜15ms の実時間がかかると 5 秒を超える。

### 原因2(連鎖): タイムアウトしたテストの非同期ループが後続テストの `drum` を使い続ける

Jest はタイムアウトしたテスト関数を止めない。「最後の切り替えの直前は…」の `for` ループはバックグラウンドで動き続け、`describe` 直下の `let drum` を参照する。`beforeEach` で `drum` が次のテスト用に差し替わると、ゾンビのループが次のテストの `drum` に `initialize`・`spin`・`destroy` をかけ、`afterEach` の `jest.useRealTimers()` とも干渉する。上表の「1人しかいないのに `Member1`」「間隔 0ms」「`scale(1.1)` が出ない」「destroy 後に `getTimerCount()` が 0 でない」は、このゾンビによる汚染で説明できる。

確認: `await jest.advanceTimersByTimeAsync(` を同期の `jest.advanceTimersByTime(` に置き換えた一時コピーでは、3 回とも 10 件すべて通り、「最後の切り替えの直前は…」は 5007ms → 約 80ms になった(一時ファイルは削除済み)。

### 原因3(負荷の上乗せ): `npm test` が `.claude/worktrees/` 配下のテストも拾う

`jest.config.js` の `testMatch: ['**/tests/**/*.test.js']` に除外が無く、`testPathIgnorePatterns` も既定(`/node_modules/`)のまま。そのため元のチェックアウトで `npm test` を流すと、別トピックのワークツリー(調査時点では `.claude/worktrees/cors-exact-match/`)のテストも同時に走る。並列ワーカーが倍になって負荷が上がるうえ、他ブランチの古いテストが落ちれば、こちらの `npm test` も落ちる。完了条件の「ローカルで `npm test` を 5 回続けて全件通る」は、これを除外しないと他トピックの状態に左右される。

### `js/animations/drum-roll.js` のタイマーの扱い

- 切り替え・確定後の強調のタイマーは `setTimer` で `this.timers` に登録され、`destroy` → `clearTimers` で止まる。問題なし。
- `showMember` の `requestAnimationFrame` は登録されず、`destroy` でも取り消されない。ただしコールバックは `if (!this.displayElement) return;` で抜けるため副作用は無い。偽 rAF は「`16 - ((clock.now - start) % 16)`」で次のフレームを決めるので、開始時刻しだいで destroy 時点に rAF が残る可能性を疑ったが、`jest.useFakeTimers({ now })` で `now` を 0〜15 に振って destroy 後の `jest.getTimerCount()` を数えたところ、すべて 0 だった。destroy テストの失敗は原因2の連鎖であり、実装の修正は要らない。
- 次の切り替えの遅延は `schedule[k + 1] - (Date.now() - startTime)` で、`Date.now` は偽タイマーで偽物になるため、偽タイマー上では決定的。

### 実時間のテスト(fast-check)

「spin 後の表示が当選者(人数 1〜30、実時間)」は 10 回 × (duration 150ms + 確定後 400ms)で、計 5.8〜6.3 秒(タイムアウト 30 秒)。正しさは切り替え回数で決まり時間に依存しないので、負荷で変わるのは所要時間だけ。タイマー分解能が 15.6ms でも 1 回あたり最大 30 切り替え程度で、30 秒には余裕がある。

### ほかのテスト

`tests/unit/card-flip.test.js` も `advanceTimersByTimeAsync` を使うが、1 回の spin のタイマー数が少なく、今回は失敗していない。同じ仕組みの潜在リスクはあるが、このトピックの範囲外とする。

## 選択肢の比較

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A: drum-roll のテストの `advanceTimersByTimeAsync` を同期の `advanceTimersByTime` にする | 偽タイマーの発火が実時間に一切依存しなくなる。80ms 程度で終わる。テストの期待値は変えない | `spin` の途中に Promise をはさむ実装に将来変えると、同期 advance では進まなくなる | 今の `spin` は切り替えがすべてタイマーの連鎖で、途中に await が無い。`await promise` は最後に resolve 済み |
| 案B: テストにタイムアウトを指定する(例: 30 秒)| 変更が小さい | 実時間依存は残り、分解能が悪い日はさらに遅い。ゾンビ化の連鎖も残る。「テストを緩める」に当たる | 依頼で避けるよう指示されている |
| 案C: 反復の組み合わせを減らす | 速くなる | 検証範囲が減る。実時間依存は残る | 「緩める」に当たる |
| 案D: jsdom の window に `setImmediate` を生やす(setupFiles)| 非同期 advance のまま実時間依存がほぼ消える | テスト環境にグローバルを足す副作用。fake-timers の内部実装(`_global.setImmediate`)に依存 | 全テストに影響 |

あわせて、原因3について:

| 選択肢 | メリット | デメリット |
| --- | --- | --- |
| 案E: `jest.config.js` に `testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/']` を足す | 他トピックのワークツリーのテストを拾わない。ESLint も `.claude` を除外済み([eslint-flat-config-ignores](../memory/entries/eslint-flat-config-ignores.md))で揃う | ワークツリー内で `npm test` するときの `<rootDir>` はワークツリー自身なので、そちらの実行には影響しない(要確認: rootDir がワークツリーのとき `.claude/` を含むパスにならないこと) |
| 案F: 何もしない(元のチェックアウトで `npm test` しない運用にする) | 変更なし | 完了条件のローカル 5 回連続通過が他トピックに左右される |

## 推奨アプローチ

案A + 案E。

- 案A: drum-roll のテストの偽タイマーを同期で進める。実時間との混ざりが根本原因なので、これを断つ。期待値・反復範囲・実時間テストは変えない。
- 案E: `testPathIgnorePatterns` で `.claude/` を除外する。
- `js/animations/drum-roll.js` は変更しない(タイマーの扱いに不具合は見つからなかった)。

## 制約・リスク

- 案Aは今の `spin` の作りに依存する。将来 `spin` の途中に await を入れると同期 advance で進まなくなるが、その場合は `await promise` がタイムアウトで落ちるので気づける。
- 案Eで、`<rootDir>` が `C:\...\roulette\.claude\worktrees\<slug>` のとき、ワークツリー内のテストのパスは `<rootDir>/tests/...` で `<rootDir>/.claude/` には当たらない。Jest の `testPathIgnorePatterns` は絶対パスへの正規表現で、`<rootDir>` は置換される。Windows で `--listTests --testPathIgnorePatterns '/node_modules/' '<rootDir>/.claude/'` を試し、元のチェックアウトではワークツリー配下の 28 件が 0 件になり、ワークツリー内では自分のテスト 14 件がそのまま列挙されることを確かめた。

## 未解決の疑問・要確認事項

- card-flip のテストも同じ書き方で潜在的に同じリスクがある(「duration 直後は…」が 2725ms)。設計の壁打ちで、今回あわせて直すことになった。

## 参考資料

- `node_modules/@sinonjs/fake-timers/src/fake-timers-src.js:1034`(`originalSetTimeout = _global.setImmediate || _global.setTimeout`)、`:1321`(`tickAsync` の譲り)
- Jest 29 `testPathIgnorePatterns`(https://jestjs.io/docs/29.7/configuration#testpathignorepatterns-arraystring)

---
次のアクション: `/loop-basic:design` で設計フェーズに進む

スキル化候補: [[jest-esm-globals]](related_topics 3件)
