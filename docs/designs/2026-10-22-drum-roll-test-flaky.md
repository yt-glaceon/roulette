# 設計: drum-roll のテストがローカル Windows で不安定に失敗する件の修正

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-22-drum-roll-test-flaky.md](../investigations/2026-10-22-drum-roll-test-flaky.md)
- 承認者: ユーザー(yt-glaceon)
- 承認日: 2026-10-22

## 目的・スコープ

### やること

- `tests/unit/drum-roll.test.js` の偽タイマーを、実時間に依存しない同期の `jest.advanceTimersByTime` で進める(根本原因: jsdom 環境の `advanceTimersByTimeAsync` が偽タイマー1件ごとに本物の `setTimeout` で待つ)。
- `tests/unit/card-flip.test.js` も同じ理由で同期 advance にする(壁打ちで範囲に追加。今は通っているが、「duration 直後は光が当選カードだけに付き…」が現時点で 2725ms と既定の 5 秒に近く、同じ仕組みで落ちうる)。
- `jest.config.js` に `testPathIgnorePatterns` を足し、`.claude/`(他トピックのワークツリー)配下のテストを拾わないようにする。

### やらないこと(スコープ外)

- テストのタイムアウト延長・反復の削減・スキップ(テストを緩めない)。
- テストの期待値・反復の組み合わせの変更。
- 実時間の fast-check テスト(「spin 後の表示が当選者(人数 1〜30、実時間)」)の変更。正しさは時間に依存せず、所要時間 6 秒前後でタイムアウト 30 秒に余裕がある。
- `js/animations/drum-roll.js` の変更。調査でタイマーの扱いに不具合は見つからなかった(destroy 後の `getTimerCount()` の失敗は、タイムアウトしたテストの連鎖だった)。
- `js/animations/card-flip.js` の変更。

## アーキテクチャ・変更概要

| ファイル | 変更 |
| --- | --- |
| `tests/unit/drum-roll.test.js` | `await jest.advanceTimersByTimeAsync(x)` をすべて `jest.advanceTimersByTime(x)` に置き換える(`runSpin` ヘルパー、「確定後の強調」の 10ms 刻みのループ、「destroy 後に…」の 500ms)。`runSpin` の直前に、同期で進める理由(jsdom では非同期版が偽タイマー1件ごとに実時間で待つこと、`spin` の切り替えは Promise をはさまないタイマーの連鎖なので同期で最後まで進むこと)を短くコメントで書く。`await promise` はそのまま残す |
| `tests/unit/card-flip.test.js` | `await jest.advanceTimersByTimeAsync(x)` をすべて `jest.advanceTimersByTime(x)` に置き換える(`runSpin` ヘルパーと各テストの途中の advance)。「spin の Promise は確定後の演出…のあとに resolve する」は `.then(() => { done = true; })` の結果を見るため、2 回の advance のそれぞれの直後に `await Promise.resolve();` を入れてから `done` を確かめる(非同期版では advance がマイクロタスクを流していた分を明示する。「destroy 後に…」はすでに `await Promise.resolve()` がある)。`runSpin` の直前に drum-roll と同じ理由のコメントを書く |
| `jest.config.js` | `testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/']` を追加する(既定の `/node_modules/` は明示しないと消えるため含める) |

同期 advance で `spin` が最後まで進む根拠: `spin` は Promise を作ったあと、切り替え(`step`)・確定後の強調・`finish` をすべて `setTimer`(`setTimeout`)の連鎖で進め、途中に await が無い。`showMember` の `requestAnimationFrame` も偽タイマーで、同期 advance で発火する。`finish` の `resolve()` もタイマーの中で同期に呼ばれるので、advance のあとの `await promise` はすぐ解決する。調査時の一時コピーで、10 件すべて通ることを確認済み。

card-flip も同様で、`spin` は光の移動・めくり・`finish` をすべて `schedule`(`setTimeout`)で予約し、途中に await も rAF も無い。`finish` の `resolve()` もタイマーの中で同期に呼ばれる。

## 実装ステップ

- [ ] ステップ1: `tests/unit/drum-roll.test.js` の `advanceTimersByTimeAsync` を同期の `advanceTimersByTime` に置き換え、理由のコメントを `runSpin` の直前に書く(タスク T1)
- [ ] ステップ2: `tests/unit/card-flip.test.js` を同様に置き換え、Promise の `.then` を見るテストにマイクロタスクの流しを入れる(タスク T2。T1 と独立)
- [ ] ステップ3: `jest.config.js` に `testPathIgnorePatterns` を追加する(タスク T3。T1・T2 と独立)

各ステップのあとの確認:

- T1・T2: 対象ファイルに `advanceTimersByTimeAsync` が 0 件(`grep -n advanceTimersByTimeAsync tests/unit/<ファイル>`)。対象ファイル単体の jest(`node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/<ファイル>`)で全件通過。
- T3: ワークツリー内で `--listTests` し、`tests/` の 14 件がそのまま並ぶ。

## テスト戦略

- 合格基準:
  1. ワークツリー内で `npm test` を 5 回続けて流し、5 回とも全件通る。
  2. 元のチェックアウトからの実行でも `.claude/worktrees/` 配下のテストが拾われないこと。マージ前のため、元のチェックアウトで `node --experimental-vm-modules node_modules/jest/bin/jest.js --config <ワークツリー>/jest.config.js --rootDir <元のチェックアウト> --listTests` を流す(`--rootDir` を付けないと `<rootDir>` がワークツリー自身になり確認にならない)。合格は「`.claude` を含むパスが 0 件」かつ「元のチェックアウトの `tests/` のテスト(14 件)はそのまま並ぶ」の両方。あわせてワークツリー内で `--listTests` し、ワークツリーの 14 件が並ぶことも確かめる。
  3. 「最後の切り替えの直前は…」と card-flip の「duration 直後は…」の所要時間がそれぞれ 1 秒未満になる(実時間に依存しなくなったことの確認)。対象ファイル単体を `--verbose` で流し、テスト名の横の ms 表示で確かめる。
  4. `npm run lint`・`npm run build` が通る。
  5. PR の CI(`verify`)が緑。
- 負荷の確認(参考情報、合否には使わない): 同期 advance は本物のタイマーを使わないので、この記録は「タイマー分解能が粗い状態でも通った」という傍証にとどまる。合格基準1の前後に `node -e "const t=process.hrtime.bigint();setTimeout(()=>console.log(Number(process.hrtime.bigint()-t)/1e6),0)"` で実 `setTimeout(0)` を測ってレポートに残す。`tests/` に一時ファイルは置かない。
- テストの意図が変わっていないことの確認: 期待値・反復範囲の差分が無いこと(差分が `advanceTimersByTime*` の行とコメントだけであること)を diff で確かめる。

**自動テストを新規作成するか:** しない(理由: 今回は既存テストの進め方の修正で、検証対象の振る舞いは変わらない。修正の効果は既存テストの 5 回連続通過と所要時間で確かめる)

## リスク・トレードオフ

- 同期 advance は今の `spin` の作りに依存する。将来 `spin` の途中に await を入れると、同期 advance では最後まで進まず `await promise` が 5 秒でタイムアウトする。落ち方ではっきり分かるので、そのときに非同期版へ戻すか作りを見直す。理由はコメントに残す。
- 「確定後の強調」は 10ms ごとに `display.style.transform` を記録する。同期でも advance の間に rAF と強調のタイマーが発火するので、記録される値の並びは非同期版と同じ。
- `testPathIgnorePatterns` の `<rootDir>/.claude/` は、ワークツリー内で実行したときの自分のテスト(`<rootDir>/tests/...`)には当たらない(調査で確認済み)。

## ロールバック方針

PR を revert する。テストと Jest 設定だけの変更で、本番コード・ビルド結果には影響しない(`deployNote` のとおり main へのマージで Pages へデプロイは走るが、配信物は変わらない)。

## 壁打ちの記録

- `jest.config.js` の `.claude/` 除外を範囲に入れるか → 入れる(人間の回答)。
- card-flip のテストの同じ書き方 → 今回あわせて直す(人間の回答)。調べると「spin の Promise は…」だけ `.then` の結果を見ているので、同期化に合わせてマイクロタスクを流す手当てが要ると分かり、変更概要に足した。

## 設計レビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | MAJOR | [MAJOR] 合格基準2の `--config` だけでは `<rootDir>` がワークツリーになり確認にならない → `--rootDir` を付け、合格条件を2点で明記。[MINOR] 共有メモリ jest-esm-globals が「advanceTimersByTimeAsync で進め」と逆の指針 → エントリを更新。[MINOR] 負荷計測の一時テストの扱い → `node -e` で測り参考情報扱いに。[MINOR] ステップごとの確認が無い → 追記 |
| 2 | PASS | ラウンド1の4件は解消。[MINOR] 所要時間の測り方 → `--verbose` の ms 表示と追記。[MINOR] PowerShell で grep が無い場合 → Bash ツールで流すので現状のまま |

未解決のMAJORが残った場合: なし

スキル化候補: [[jest-esm-globals]](related_topics 3件: roulette-animation-behavior, ci-actions, drum-roll-test-flaky)。ゲート1では保留としたが、同日に main へマージされた cors-exact-match で `.claude/skills/jest-esm-tests/` に Skill 化済みだった。main を取り込んだ際に、その手順4(偽タイマーの進め方)を今回の結論に合わせて更新した

## コードレビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 |  |  |

未解決のMAJORが残った場合:

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 承認 | スキル化候補 jest-esm-globals は保留 |
