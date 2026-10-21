# 設計: token-log-masking(サーバーログへの機密値出力の除去)

- 日付: 2026-10-22
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-22-token-log-masking.md](../investigations/2026-10-22-token-log-masking.md)
- 承認者: ユーザー
- 承認日: 2026-10-22

## 目的・スコープ

`server/` のログ(Render のログ)に、アクセストークン全文やインタラクショントークンが出ないようにする。

### やること

- `/roulette` のトークン生成ログ(`server/index.js:97`)と期限切れ削除ログ(`index.js:114`)を、トークンの先頭6文字 + `…` に伏せる
- `console.error` に渡しているエラーオブジェクトを、機密値を含まない要約に置き換える(`index.js:55`・`99`・`199`・`226`・`261`)。特に `interaction.reply` 失敗時の `DiscordAPIError` が持つ `url`(インタラクショントークン)と `requestBody`(アクセストークン付き URL)を出さない
- `/roulette` の catch 節で、エラー応答の `interaction.reply` が失敗しても例外を漏らさない(unhandled rejection でプロセスが落ち、エラーオブジェクトがそのまま出力されるのを防ぐ)
- 伏せ字・エラー要約を純粋関数として `server/log-safe.js` に切り出し、ルートの Jest で単体テストする
- フロントエンドから API へのアクセストークンを、クエリ `?token=` ではなく `x-access-token` ヘッダで送る。サーバーはクエリでの受け付けをやめ、ヘッダだけを読む(リクエスト URL にトークンが載らないようにする。今の Render は Hobby プランで HTTP リクエストログは無いが、プラン変更やプロキシ・ブラウザ履歴に残る経路を先に断つ)

### やらないこと(スコープ外)

- `/roulette` が返すページ URL(`FRONTEND_URL?token=…`)の形は変えない。これは GitHub Pages のページ URL で、Render には届かない。クロスオリジンの `fetch` の `Referer` は既定の `strict-origin-when-cross-origin` でオリジンだけになるので、ページ URL のクエリは API 側に渡らない
- Render に既に残っている過去のログの削除(過去のトークンは1時間で失効し、再起動でメモリからも消えているので実害はない)
- Bot トークンのローテーション(ログには出ていないことを調査で確認済み)
- ログ出力ライブラリ(pino 等)の導入、ログ書式の全面的な見直し

## アーキテクチャ・変更概要

### 新規: `server/log-safe.js`

依存なしの ES Module。次の3関数を named export する。

- `maskToken(token)`
  - 文字列で長さが12以上なら `先頭6文字 + '…'` を返す(アクセストークンは64桁の16進なので常にこちら)
  - それ以外(短い・空・文字列でない)は `'***'` を返す(短い値の全文が出ないように)
- `maskUrl(url)`
  - 文字列でなければそのまま返す(`undefined` 等)
  - パス中の `/interactions/<id>/<token>`・`/webhooks/<id>/<token>` の `<token>` 部分(`/` `?` `#` を含まない1セグメント、`[^/?#]+`)を `***` に置き換える
  - クエリの `token=<値>`(`?` または `&` の直後の `token=`、値は `&`・`#`・末尾まで)の値を `maskToken` で伏せる
- `describeError(error)` … ログ1件ぶんの文字列を返す
  - `error` が `url` または `requestBody` を持つ(discord.js の `DiscordAPIError`・`HTTPError`)場合: `${name}: ${message}` に、`code`・`status`・`method`・`url`(`maskUrl` 済み)をこの順で、値が `null`/`undefined` でないものだけ(`0` は出す)` (code=…, status=…, method=…, url=…)` の形で付ける。`requestBody` とスタックは出さない
  - それ以外の `Error`: `error.stack`(無ければ `${name}: ${message}`)を返す。アプリのバグ調査にスタックが要るため。スタックとメッセージには機密値を入れていない
  - `Error` でない値: `String(error)` を返す

### 変更: `server/index.js`

以下の行番号は変更前のもの。編集中にずれるので、ログの文言で箇所を特定すること。

- 先頭で `import { maskToken, describeError } from './log-safe.js';`
- 97行目: `` `[Roulette] トークン生成: ${maskToken(token)} (Guild: ${guildId}, User: ${interaction.user.tag})` ``
- 114行目: `` `[Roulette] 期限切れトークンを削除: ${maskToken(token)}` ``
- 55・99・199・226・261行目: 第2引数の `error` を `describeError(error)` に置き換える(メッセージ文言はそのまま)
- 100〜103行目の catch 内 `interaction.reply` を try/catch で包み、失敗時は `console.error('エラー応答の送信に失敗:', describeError(replyError))` を出して終える。`followUp` への切り替えなどの分岐は足さず、`reply` のままにする(目的は例外を漏らさないこと)
- `validateToken`(144行目): `const token = req.headers['x-access-token'];` にし、`req.query.token` を読まない。トークンが無いときのエラー応答(401 `アクセストークンが必要です`)はそのまま
- CORS 設定は変えない。フロントは既に `Content-Type: application/json` を付けているのでプリフライトは今も走っており、`cors` は `allowedHeaders` 未指定のときリクエストの `Access-Control-Request-Headers` をそのまま許可する(`server/node_modules/cors/lib/index.js` の `configureAllowedHeaders`)。`x-access-token` を足しても許可される

### 新規: `js/api-request.js`

依存なしの ES Module。`buildApiRequest(apiEndpoint, endpoint, accessToken, options = {})` を named export し、`{ url, init }` を返す。

- `url` = `${apiEndpoint}${endpoint}`(トークンを含めない)
- `init` = `{ ...options, headers: { 'Content-Type': 'application/json', 'x-access-token': accessToken, ...options.headers } }`(今の `request` と同じく、呼び出し側の `options.headers` を後から重ねる)

`js/discord-client.js` は `js/config.js`(`import.meta.env` を読む)に依存していて、コンストラクタで `config.apiEndpoint` を評価するため Jest から直接テストできない([[import-meta-env-in-jest]])。URL とヘッダの組み立てだけをこのモジュールに切り出してテストする。

### 変更: `js/discord-client.js`

- `request` の URL 組み立てとヘッダを `buildApiRequest(this.apiEndpoint, endpoint, this.accessToken, options)` に置き換え、`fetch(url, init)` を呼ぶ。エラー処理はそのまま

Render の Root Directory は `server` なので、`server/log-safe.js` は `server/` 内に置けばデプロイに含まれる。ルートの Jest の `testMatch` は `**/tests/**/*.test.js` で、テストから `../../server/log-safe.js` を相対 import できる(`server/log-safe.js` は `server/node_modules` に依存しない)。

## 実装ステップ

- [ ] ステップ1: `server/log-safe.js` を新規作成し、`maskToken`・`maskUrl`・`describeError` を実装する
- [ ] ステップ2: `tests/unit/server-log-safe.test.js` を新規作成し、下記「テスト戦略」の単体テストを書く(ステップ1に依存)
- [ ] ステップ3: `server/index.js` を上記のとおり変更する(ログの伏せ字・エラー要約・catch 内 reply の保護・`validateToken` のヘッダ限定)(ステップ1に依存。ステップ2とは独立)
- [ ] ステップ4: `js/api-request.js` を新規作成し、`js/discord-client.js` の `request` をそれを使う形に変える(ステップ1〜3とは独立)
- [ ] ステップ5: `tests/unit/api-request.test.js` を新規作成する(ステップ4に依存)

並列化: ステップ1とステップ4は同時に着手できる。ステップ2・3はステップ1の後、ステップ5はステップ4の後。

## テスト戦略

**自動テストを新規作成するか:** する(単体テスト、`tests/unit/server-log-safe.test.js` と `tests/unit/api-request.test.js`)。`server/` にはテストが無く、伏せ字の漏れは目視では見落としやすいため、純粋関数部分を自動テストで固める。`server/index.js` 本体(Discord・Express 結合部分)は自動テストしない(Bot のモックが大がかりになるため。起動確認と本番ログの確認で補う)。

単体テストの合格基準:

- `maskToken`: 64桁の16進トークンで、結果が先頭6文字 + `…` になり、元のトークン全文を含まない。fast-check で任意の64桁16進について「結果に全文が含まれない」「結果の長さが7」を確かめる。短い文字列・空文字・`undefined`・数値は `'***'`
- `maskUrl`: `https://discord.com/api/v10/interactions/123/abcTOKEN/callback` の `abcTOKEN` が出ない。`/webhooks/<id>/<token>/messages/@original` も同様。`https://example.com/?token=<64桁>` と `https://example.com/?a=1&token=<64桁>&b=2` は先頭6文字だけ残り、`a=1`・`b=2` は残る。トークンを含まない URL は変わらない。文字列でない値はそのまま返る
- `describeError`: `url`・`requestBody`・`code`・`status`・`method` を持つ疑似 `DiscordAPIError`(`requestBody.json.data.content` にアクセストークン付き URL、`url` にインタラクショントークン)を渡し、結果にどちらのトークンも含まれず、`requestBody` の中身も含まれず、`code`・`status`・`method` は含まれる。普通の `Error` ではスタック(または `name: message`)が返る。`Error` でない値は文字列化される

- `buildApiRequest`: 返る `url` にトークン(`token=` も値も)が含まれず `${apiEndpoint}${endpoint}` と一致する。`init.headers['x-access-token']` がトークン、`Content-Type` が `application/json`。`options.headers` を渡すと重ねられ、`options` のほかのキー(`method` 等)も `init` に残る

そのほかの確認:

- `npm test` が全件通る、`npm run build` が通る
- サーバーの起動確認(下記)の中で `curl` を使い、`GET /api/validate-token?token=dummy` と、ヘッダ無しの `GET /api/validate-token` がどちらも 401 `アクセストークンが必要です` になること、`x-access-token: dummy` ヘッダ付きは 401 `無効なトークンです` になること(クエリを読まずヘッダを読んでいることの確認)。`Origin: http://localhost:5500` と `Access-Control-Request-Headers: content-type,x-access-token` を付けた `OPTIONS` が 204 で `Access-Control-Allow-Headers` に `x-access-token` を含むこと
- `server/index.js` が構文・import エラーなく読み込める: [[worktree-server-env-live-token]] に従い、`.env` の無いディレクトリを cwd にし、`DISCORD_BOT_TOKEN` を空にして起動し、`Server running on port …` が出ることと `GET /` が応答することを確かめる(Bot ログインは失敗してよい)
- 差分に、トークン全文を出す `console.*` が残っていないこと(`grep` で `${token}` 等を確認)
- マージ前(人間、打鍵確認): 実 API に繋いだフロントでの確認は、本番 Bot と二重ログインしないよう Render 側で行うのが現実的なので、マージ前はワークツリーで `npm run dev` → `?mock` で画面が従来どおり動くことだけを確認する(モックは `DiscordClient` を通らないので、ヘッダ送信の確認にはならない)
- リリース後(人間): Render のデプロイ一覧で Trigger が自動(コミット)か手動かを確認([[render-root-dir-autodeploy]] の未確認事項)。Render と GitHub Pages の両方のデプロイ完了後、Discord で `/roulette` を実行して URL を開き、チャネル一覧・メンバー取得・抽選まで動くこと、Render のログが `トークン生成: xxxxxx… (Guild: …)` の形になっていること

## リスク・トレードオフ

- 先頭6文字(24bit)はログに残る。残り58桁(232bit)が秘密として残るので、推測の役には立たない
- エラーログからスタック(Discord API エラーのとき)と `requestBody` が消えるため、Discord API の失敗の原因調査で得られる情報が減る。`code`・`status`・`method`・伏せた `url`・メッセージは残るので、原因の特定には足りる見込み
- `client.login(...)`(25行目)は await も catch も無く、失敗時は unhandled rejection としてエラーがそのまま出力される。ここに機密値が載る既知の経路は無い(Bot トークンはエラーに含まれない)ので、今回は対象外とする
- ページ URL の `?token=` が API 側に渡らない根拠は、`index.html` に Referrer-Policy の指定が無く、ブラウザ既定の `strict-origin-when-cross-origin` に依存していること。ページ URL 自体はブラウザ履歴に残る(スコープ外)
- `describeError` が判定に使うのは「`url` か `requestBody` を持つか」というダックタイピング。discord.js の将来の版で形が変わると、普通の `Error` 扱いになりスタックだけが出る(その場合も `requestBody` は出ない)
- `server/` の変更なので、main へのマージで Render の自動デプロイが走る想定(未確認)。走らなければ人間が手動デプロイする
- **デプロイの順序**: サーバーのクエリ受け付け廃止とフロントのヘッダ送信は同じ PR で main に入る。GitHub Pages(Actions)と Render は別々にデプロイされるので、次の状態が一時的に生じる
  - 新サーバー + 旧フロント(Render が先に終わった場合、または開いたままの旧タブ): 旧フロントはクエリで送るので 401(「トークンが無効または期限切れ」表示)。ページを再読み込みすれば新フロントになり、ページ URL の `?token=` は残っているのでそのまま使える
  - 旧サーバー + 新フロント(Pages が先、または Render の自動デプロイが走らない場合): 旧サーバーもヘッダを受け付けるので問題なし
  - 利用者が少ない(身内の Discord サーバー)ので、数分の 401 は許容する(壁打ちで人間が廃止を選択)。避けたい場合は、Render のデプロイ完了を待ってから再読み込みすればよい
- Render の自動デプロイが走らないと、手動デプロイまで旧サーバー(クエリも受け付ける)のまま。機能上は問題ないが、ログの伏せ字も反映されないので、リリース時に必ずデプロイを確認する

## ロールバック方針

PR を revert して main にマージし、Render で再デプロイする(自動デプロイが走らなければ手動)。データや設定の変更は無いので、コードを戻すだけで元に戻る。revert 後も、戻した旧フロントはクエリで、旧サーバーはクエリ・ヘッダの両方を受け付けるので、デプロイの順序による不整合は起きない。

## 壁打ち(grilling)の記録

- Q1 伏せ方: 先頭6文字 + `…` で確定
- Q2 エラー要約の範囲: Discord API を呼ぶ箇所だけでなく、全 `console.error` を `describeError` に揃える
- Q3 フロントの `?token=` クエリ送信: 当初スコープ外としていたが、人間の判断で今回に含める(`x-access-token` ヘッダ送信に変更)
- Q4 Render のプラン: Hobby(HTTP リクエストログ無し)。Q3 は実害の対処ではなく予防
- Q5 サーバーのクエリ受け付け: 今回廃止する。デプロイ順序による一時的な 401 を許容(リスク欄に記載)
- 調べて分かったこと: CORS は既にプリフライトが走っており許可ヘッダは反射なので変更不要。`DiscordClient` は `config.js` 経由で `import.meta.env` を読むため、URL・ヘッダの組み立てを `js/api-request.js` に切り出してテストする

## 設計レビュー結果

`design-reviewer` による自動レビュー(最大2ラウンド、`/design` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | MINOR 7件: `maskUrl` の正規表現仕様、`describeError` の書式と `0` の扱い、`client.login` の reject が対象外であることの明記、行番号ずれ、catch 内は `reply` のまま、Referrer-Policy の根拠。すべて反映(curl 確認は「テスト戦略」に期待値つきで記載済み) |

未解決のMAJORが残った場合: なし

## コードレビュー結果

`code-reviewer` による自動レビュー(最大2ラウンド、`/implement` 実行時)の記録。

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 |  |  |

未解決のMAJORが残った場合: (未実施)

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-22 | 承認 | 設計レビュー PASS(MINOR 反映済み)の状態で承認 |
