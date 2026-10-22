# テストレポート: CORS の許可オリジン判定を完全一致にする(cors-exact-match)

- 日付: 2026-10-22
- ステータス: レビュー待ち
- 対応する設計ドキュメント: docs/designs/2026-10-22-cors-exact-match.md

## テスト対象

CORS の許可判定を前方一致(`startsWith`)から完全一致に直した変更。実装ステップ1〜4すべて。

- `server/cors-origin.js`(新規、純粋関数 `isAllowedOrigin`)
- `tests/unit/server-cors-origin.test.js`(新規、単体テスト)
- `server/index.js`(`isAllowedOrigin` を使う形に置き換え)
- README.md・server/README.md・SETUP.md の CORS の記述

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test` 全体。1回目: 1件失敗(下記参照)。2回目以降(計3回): 15スイート 187件すべて pass。`server-cors-origin.test.js` は毎回 pass。`drum-roll.test.js` を `npm test -- tests/unit/drum-roll.test.js` で単体再実行: 10件 pass | pass(1回目に既知の不安定テスト由来と思われる1件失敗あり) |
| 型チェック/Lint | `npm run lint`(`--max-warnings 0`)エラー・警告なし。`npm run build`(vite build)成功 | pass |
| 静的確認 | `grep -n startsWith server/index.js` が 0 件。`完全一致` の件数は README.md: 2、server/README.md: 2、SETUP.md: 2 | pass |
| 手動確認(ゴールデンパス) | ダミートークンで起動し curl。Origin 無し GET / が 200、許可3オリジンが 200 かつ ACAO がその値 | pass |
| 手動確認(エッジケース) | 前方一致で通っていた `https://yt-glaceon.github.io.attacker.example`・`http://localhost:55000`、末尾 `/` 付きが 500 で ACAO 無し。`/api/validate-token` に許可オリジン + トークン無しで 401(ACAO 付き = CORS は通る) | pass |

### 1回目の全体テストでの失敗について

1回目の `npm test` で `Tests: 1 failed, 186 passed, 187 total`(1スイート失敗)だった。出力を tail で切っていたため、失敗したスイート名は記録できていない。その後の全体実行3回はすべて 187 件 pass、`drum-roll.test.js` 単体も pass。共有メモリ [[drum-roll-test-timeout-flaky]] の既知事象(コード無変更でも落ちる)と整合するが、失敗スイートの特定はできていないため断定はしない。今回の変更(server/ と文書のみ、drum-roll は無関係)で再現する失敗ではない。テストは緩めていない。なお出力中の `result-manager` の「クリップボードコピーエラー」は、そのテストが意図的にエラーを起こした console.error の出力で、失敗ではない(result-manager.test.js は後の実行で PASS)。

## 証跡(手動確認分)

起動方法: cwd をスクラッチパッド(`.env` 無し)にし、`PORT=3999 DISCORD_BOT_TOKEN=dummy.fake.token node --unhandled-rejections=warn <worktree>/server/index.js` をバックグラウンドで起動。起動ログは `Server running on port 3999` と `TokenInvalid` の警告のみで、`Bot logged in as` は出ていない(本番 Bot へのログインなし)。

curl の応答(ステータス行と Access-Control-Allow-Origin のみ抜粋):

| リクエスト | ステータス | Access-Control-Allow-Origin |
| --- | --- | --- |
| `GET /`(Origin 無し) | HTTP/1.1 200 OK | なし |
| `GET /` Origin: `https://yt-glaceon.github.io` | HTTP/1.1 200 OK | `https://yt-glaceon.github.io` |
| `GET /` Origin: `http://localhost:5500` | HTTP/1.1 200 OK | `http://localhost:5500` |
| `GET /` Origin: `http://127.0.0.1:5500` | HTTP/1.1 200 OK | `http://127.0.0.1:5500` |
| `GET /` Origin: `https://yt-glaceon.github.io.attacker.example` | HTTP/1.1 500 Internal Server Error | なし |
| `GET /` Origin: `http://localhost:55000` | HTTP/1.1 500 Internal Server Error | なし |
| `GET /` Origin: `https://yt-glaceon.github.io/` | HTTP/1.1 500 Internal Server Error | なし |
| `GET /api/validate-token` Origin: `https://yt-glaceon.github.io`(トークン無し) | HTTP/1.1 401 Unauthorized | `https://yt-glaceon.github.io` |

確認後、PID 29124 のサーバープロセスを停止し、ポート 3999 に LISTEN が残っていないことを確認済み。

## 不合格・不具合の詳細

なし(1回目の全体テストの1件失敗は上記のとおり再現せず、既知の不安定テストの事象として記録)。

## 未検証の観点・既知の制限事項

- PR の CI(`verify`)の結果は未確認(PR 作成前のため)。
- 実トークンでの動作(実際の Discord データ、実ブラウザからの本番フロントエンド → Render のバックエンドの通信)は未検証。ブラウザの preflight(OPTIONS)は `methods: ['GET']` のままで今回の対象外。
- `Origin: null`・空文字・大文字違い・`:443` 付きなどの表記違いは、curl ではなく単体テストでのみ確認。
- 1回目の全体テストで失敗したスイート名は特定できていない。
- Render への自動デプロイ後の本番確認は未実施。

## コードレビューからの引き継ぎ

未解決の MAJOR: なし(コードレビュー1ラウンドで PASS。MINOR の括弧の全角化は対応済み)。

## 総合判定

合格

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
|  | 承認してクローズ / 修正依頼 / 設計からやり直し |  |
