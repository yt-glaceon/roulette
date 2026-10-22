# テストレポート: drum-roll のテストがローカル Windows で不安定に失敗する件の修正

- 日付: 2026-10-22
- ステータス: レビュー待ち
- 対応する設計ドキュメント: docs/designs/2026-10-22-drum-roll-test-flaky.md

## テスト対象

テストと Jest 設定だけの変更(本番コードは変更なし)。

- `tests/unit/drum-roll.test.js`・`tests/unit/card-flip.test.js`: `advanceTimersByTimeAsync` を同期の `advanceTimersByTime` に置き換え(card-flip の `.then` を見るテストには `await Promise.resolve()` を追加)
- `jest.config.js`: `testPathIgnorePatterns` に `/node_modules/` と `<rootDir>/.claude/` を追加

設計の実装ステップ1〜3(T1・T2・T3)の全範囲。ブランチ feature/drum-roll-test-flaky(origin/main 取り込み済み)のワークツリー内で検証した。

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト(合格基準1) | ワークツリー内で `npm test` を 5 回連続。毎回 Test Suites 15 passed / Tests 187 passed。所要(Jest の Time): 8.64s / 8.494s / 8.534s / 8.575s / 8.523s。失敗 0 回 | pass |
| 自動テスト(合格基準3) | drum-roll 単体 `--verbose`: 「最後の切り替えの直前は…」78 ms(10 件通過、全体 6.68s)。card-flip 単体: 「duration 直後は…」28 ms(14 件通過、全体 1.34s)。いずれも 1 秒未満 | pass |
| 自動テスト(合格基準2) | 元のチェックアウトを `--rootDir` に、ワークツリーの jest.config.js で `--listTests`: 15 件。`.claude` を含むパスは 0 件。元のチェックアウトの `tests/unit/` は実数 15 件(ファイル数も 15)で全件が並んだ(PR #11 で 14 から増えた分を読み替え) | pass |
| 自動テスト(ワークツリー内 listTests) | ワークツリー内で `--listTests`: 15 件、すべて `<ワークツリー>\tests\unit\*.test.js` | pass |
| 型チェック/Lint(合格基準4) | `npm run lint`(`eslint . --max-warnings 0`)エラー・警告 0、exit 0。`npm run build`(vite)成功、exit 0。typecheck・e2e は loop.config で null のためスキップ | pass |
| テストの意図が変わっていないことの確認 | `git diff main...HEAD -- tests/` の差分は、advance 呼び出しの置き換え、card-flip の `await Promise.resolve()` 2 行、コメント(runSpin 直前の理由)のみ。期待値・反復範囲・テスト名の変更なし | pass |
| 手動確認(ゴールデンパス) | 該当なし(テスト基盤の修正のため。効果は既存テストの連続通過と所要時間で確認) | - |
| 手動確認(エッジケース) | 該当なし | - |

### 参考情報: 実 setTimeout(0) の実測(合否には使わない)

`node -e` で 5 回測定(ms): 2.561 / 2.5703 / 0.7626 / 2.5006 / 1.0541。測定は `npm test` の前に実施した。同期 advance は本物のタイマーを使わないので、「タイマー分解能が粗い状態でも通った」ことの強い傍証にはならない。この実行時点の分解能は 1〜2.6ms 程度で、最悪条件ではない。

### 補足

- ワークツリー内の `--listTests` の出力は、ワークツリー自身のパスが `.claude/worktrees/` 配下のため、パス文字列に `.claude` を含む(15 件)。これは自分のテストで、除外対象(`<rootDir>/.claude/`)に当たらないことを意味する(設計のリスク欄どおり)。「`.claude` を含むパス 0 件」の判定は元のチェックアウト側の実行で行った。
- 元のチェックアウトの実行で出た jest-haste-map の重複名の警告は既知で、テストパスではない。元のチェックアウトのファイルは変更していない。

## 証跡(手動確認分)

該当なし(自動テストと CLI 実行のみで確認が完結)。

## 不合格・不具合の詳細

なし

## 未検証の観点・既知の制限事項

- PR の CI(`verify`、合格基準5)は未確認(release で確認)。
- 同期 advance は今の `spin` の作りに依存する(設計のリスク欄)。将来 `spin` に await が入ると 5 秒でタイムアウトして分かる。
- 実時間の fast-check テスト(「spin 後の表示が当選者」)は設計どおり変更しておらず、実時間依存のまま(所要 6 秒前後、タイムアウト 30 秒)。
- 実 setTimeout の分解能がより粗い環境(負荷時)での再現確認はしていない。
- typecheck・e2e は未構成(null)のためスキップ。

## コードレビューからの引き継ぎ

未解決の MAJOR なし。MINOR(コメントの「非同期版」「Async 版」の不揃い)は意味が通じるため見送り。

## 総合判定

合格(PR の CI は未確認。release で確認)

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
|  | 承認してクローズ / 修正依頼 / 設計からやり直し |  |
