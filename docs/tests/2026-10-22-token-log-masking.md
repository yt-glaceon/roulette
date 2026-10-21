# テストレポート: token-log-masking(サーバーログへの機密値出力の除去)

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する設計ドキュメント: docs/designs/2026-10-22-token-log-masking.md

## テスト対象

`server/` のログからアクセストークン全文・インタラクショントークンを除去する変更(ステップ1〜5 すべて)。

- `server/log-safe.js`(新規): `maskToken`・`maskUrl`・`describeError`
- `server/index.js`: ログの伏せ字化、`describeError` への置き換え、catch 内 `interaction.reply` の保護、`validateToken` を `x-access-token` ヘッダ限定に変更
- `js/api-request.js`(新規)・`js/discord-client.js`: アクセストークンをクエリではなく `x-access-token` ヘッダで送る
- `tests/unit/server-log-safe.test.js`・`tests/unit/api-request.test.js`(新規)

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test`: 14 スイート 167 件すべて通過(`server-log-safe` 21件・`api-request` 5件を含む) | pass |
| ビルド | `npm run build`(Vite): 15 モジュール変換、成功 | pass |
| 型チェック/Lint | 未構成(`docs/process/project-dev.md` のとおり)。該当なし | 該当なし |
| 手動確認(ゴールデンパス) | ダミートークンでサーバー起動 → `Server running on port 3999` が出る。`GET /` が 200。`x-access-token` ヘッダ付きで 401 `無効なトークンです`(ヘッダを読んでいる) | pass |
| 手動確認(エッジケース) | `?token=dummy`・ヘッダ無しはどちらも 401 `アクセストークンが必要です`(クエリを読まない)。`OPTIONS` プリフライトが 204 で `Access-Control-Allow-Headers` に `x-access-token` を含む | pass |
| 手動確認(ログの実出力) | 本物の `DiscordAPIError` を `describeError` に通すと、インタラクショントークンが `***` になり `requestBody` は出ない。生の `console.error` との比較あり | pass |
| 手動確認(ブラウザ) | 実 `DiscordClient` が API へトークンをヘッダで送り、URL にクエリが付かない(下記「ブラウザでの確認」) | pass |
| 静的確認(grep) | `server/`・`js/` にトークン全文を出す `console.*` と `token=` のクエリ組み立て(API 呼び出し用)が残っていない | pass |

## 証跡(手動確認分)

### サーバー起動

cwd は scratchpad 配下の `.env` の無いディレクトリ(`ls -a` の結果は `.` と `..` のみ)。`server/` を cwd にしていない。

```
DISCORD_BOT_TOKEN=dummy.fake.token PORT=3999 node --unhandled-rejections=warn <worktree>/server/index.js
```

起動ログ(stdout):

```
🚀 Server running on port 3999
```

起動ログ(stderr)。ダミートークンなので Bot のログインは TokenInvalid で失敗する(想定どおり。設計の「リスク」にある `client.login` の unhandled rejection で、`--unhandled-rejections=warn` によりプロセスは落ちない)。スタックはリポジトリ内のパスのみで、トークン類は出ていない。

```
(node:15184) UnhandledPromiseRejectionWarning: DiscordjsError [TokenInvalid]: An invalid token was provided.
    at WebSocketManager.connect (...\server\node_modules\discord.js\src\client\websocket\WebSocketManager.js:140:26)
    at Client.login (...\server\node_modules\discord.js\src\client\Client.js:229:21)
    at file:///.../token-log-masking/server/index.js:26:8
    ...
(node:15184) UnhandledPromiseRejectionWarning: Unhandled promise rejection. ... (rejection id: 1)
```

### curl(`curl -si`、レスポンスをそのまま掲載)

1. `GET /api/validate-token?token=dummy` → 期待: 401 `アクセストークンが必要です`

```
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Vary: Origin
Content-Type: application/json; charset=utf-8
Content-Length: 51

{"error":"アクセストークンが必要です"}
```

2. `GET /api/validate-token`(ヘッダ無し) → 期待: 同上

```
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Vary: Origin
Content-Type: application/json; charset=utf-8
Content-Length: 51

{"error":"アクセストークンが必要です"}
```

3. `GET /api/validate-token` + `x-access-token: dummy` → 期待: 401 `無効なトークンです`

```
HTTP/1.1 401 Unauthorized
X-Powered-By: Express
Vary: Origin
Content-Type: application/json; charset=utf-8
Content-Length: 39

{"error":"無効なトークンです"}
```

4. `OPTIONS /api/validate-token`(`Origin: http://localhost:5500`、`Access-Control-Request-Method: GET`、`Access-Control-Request-Headers: content-type,x-access-token`) → 期待: 204 で Allow-Headers に `x-access-token`

```
HTTP/1.1 204 No Content
X-Powered-By: Express
Access-Control-Allow-Origin: http://localhost:5500
Vary: Origin, Access-Control-Request-Headers
Access-Control-Allow-Methods: GET
Access-Control-Allow-Headers: content-type,x-access-token
Content-Length: 0
```

5. `GET /` → 期待: 200

```
HTTP/1.1 200 OK
X-Powered-By: Express
Vary: Origin
Content-Type: application/json; charset=utf-8
Content-Length: 44

{"status":"ok","bot":"not ready","guilds":0}
```

### サーバーの停止確認

確認後に PID 15184 を終了。`netstat` で 3999 番の LISTEN が無いこと、`curl http://localhost:3999/` が接続できない(curl 終了コード 7)ことを確認した。

### describeError の実ログ確認(ダミー値のみ)

`@discordjs/rest` の本物の `DiscordAPIError` を、url に `/interactions/123/FAKEINTERACTIONTOKEN/callback`、body の content に `https://example.com/roulette/?token=<64桁ダミー>` を入れて生成し、`describeError` に通した出力:

```
DiscordAPIError[10062]: Unknown interaction (code=10062, status=404, method=POST, url=https://discord.com/api/v10/interactions/123/***/callback)
```

比較: 同じエラーを `console.error('[Roulette] エラー:', err)` にそのまま渡した場合(修正前の出し方):

```
[Roulette] エラー: DiscordAPIError[10062]: Unknown interaction
    at <scratchpad>/describe.mjs:8:13 {
  rawError: { message: 'Unknown interaction', code: 10062 },
  code: 10062,
  status: 404,
  method: 'POST',
  url: 'https://discord.com/api/v10/interactions/123/FAKEINTERACTIONTOKEN/callback',
  requestBody: { files: [], json: { type: 4, data: [Object] } }
}
```

- 修正前はインタラクショントークン(`FAKEINTERACTIONTOKEN`)が `url` にそのまま出る。修正後は `***` になる。
- `requestBody` は修正前は出力に含まれる。この再現では Node の既定の表示深さにより `data` が `[Object]` に省略され、content のアクセストークンまでは出なかった。ただし深さの既定に依存するだけで、`requestBody` を出さない `describeError` の方針は妥当(`util.inspect` の設定や構造が変われば出うる)。

### ブラウザでの確認(メインエージェントが実施)

上と同じ手順でダミートークンのサーバーを 3999 番で起動し、ワークツリーで `VITE_API_URL=http://localhost:3999` を指定して Vite 開発サーバー(5500 番)を起動した(設定はワークツリーの `.claude/launch.json`。コミットしない)。アプリ内ブラウザで `http://localhost:5500/roulette/?token=<ダミー>` を開いた。

ネットワーク(3999 番宛て):

```
OPTIONS http://localhost:3999/api/validate-token → 204 No Content
GET     http://localhost:3999/api/validate-token → 401 Unauthorized
```

画面: 「ボイスチャネルを選択」の上に `無効なトークンです` のエラーと「閉じる」ボタン。

- API の URL に `?token=` が付いていない
- サーバーの応答が `無効なトークンです`(クエリで送っていれば、またはヘッダが無ければ `アクセストークンが必要です` になる)なので、`x-access-token` ヘッダが CORS のプリフライトを通ってサーバーに届いている
- 確認後に両サーバーを停止し、3999 番・5500 番の LISTEN が無いことを確認した

### grep(`server/` と `js/`)

- `console.*` を全件確認。サーバーは `maskToken(token)` または `describeError(...)` を通した値のみで、トークン全文を出すものは無い(`server/index.js` の 56・98・100・107・119・204・231・266 行)。`js/` の `console.*` は、トークンや `error` オブジェクトを出す箇所はあるが、アクセストークン変数を直接出すものは無い(`js/discord-client.js` の `error` はクライアント側のブラウザコンソール)。
- `token=` / `query.token`: `server/index.js:91` の `` `${frontendUrl}?token=${token}` `` のみ。これは `/roulette` が返すページ URL で、設計の「スコープ外」(形は変えない)。ログには出していない。`server/log-safe.js` の 2 件は伏せ字処理の定義・コメント。`js/` に `token=` のクエリ組み立ては無い。`req.query.token` の参照は無い。

## 不合格・不具合の詳細

なし

## 未検証の観点・既知の制限事項

- 実 Bot での `/roulette` の動作(Bot のログインはダミートークンのため失敗する状態で確認した。本番 Bot との二重ログインを避けるため)
- Render のデプロイの Trigger(自動かコミットか手動か)の確認([[render-root-dir-autodeploy]] の未確認事項。リリース後に人間が確認)
- 本番フロント(GitHub Pages)と Render の疎通、Render のログが `トークン生成: xxxxxx… (Guild: …)` の形になっていること(リリース後に人間が確認)
- `server/index.js` 本体(Discord・Express 結合部分)の自動テストは無い(設計どおり)。`/roulette` の catch 内 `reply` 失敗時の挙動は、実 Bot では再現していない

## コードレビューからの引き継ぎ

なし(未解決の MAJOR なし。MINOR 2件は対応不要と判断済み)

## 総合判定

合格

## リリース時の追記(main 取り込み後の再検証)

PR #7 のマージ時に、先に main に入った ci-actions(PR #6、ESLint と CI の導入)と `docs/memory/` の2ファイル(`MEMORY.md` の索引追記、`import-meta-env-in-jest.md` の `related_topics`)が衝突した。人間の了承を得て、両方の追記を残す形で解決し、origin/main をマージした。取り込み後に再検証した結果は次のとおり。

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| Lint | `npm run lint`(`eslint . --max-warnings 0`、`npm ci` 後) | pass |
| 自動テスト | `npm test`: 14スイート 167件 | pass |
| ビルド | `npm run build` | pass |

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 承認してクローズ | 合格の状態で承認。リリース後に実 Bot・Render のデプロイ Trigger・本番ログの形を確認する |
