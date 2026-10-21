# 調査: token-log-masking(サーバーログへの機密値出力の除去)

- 日付: 2026-10-22
- ステータス: 完了
- 関連する設計ドキュメント: [2026-10-22-token-log-masking](../designs/2026-10-22-token-log-masking.md)

## 背景・目的

2026-10-21 の Node 24 移行作業中に、Render のログに `/roulette` で発行したアクセストークンの全文が残っているのを見つけた。アクセストークンは有効期限(1時間)の間、`/api/guild`・`/api/guild/channels`・`/api/guild/channels/:id/members` を呼べる認可情報なので、Render のログを見られる人がそのギルドのボイスチャネルやメンバー情報を取得できてしまう。

この調査では、`server/` 全体でログに機密値(アクセストークン・Bot トークン・Discord のインタラクショントークンなど)が出る経路を洗い出し、直し方を比較する。

## 現状の把握

`server/` のコードは `server/index.js` の1ファイルだけ(テストなし)。ログ出力は `console.log` / `console.error` の11箇所。

| 行 | 出力 | 機密値 | 評価 |
| --- | --- | --- | --- |
| `index.js:28` | `Bot logged in as ${client.user.tag}` | なし(Bot のユーザー名) | 問題なし |
| `index.js:48`・`53` | スラッシュコマンド登録の開始・完了 | なし | 問題なし |
| `index.js:55` | `console.error('スラッシュコマンドの登録エラー:', error)` | `rest.put` の `DiscordAPIError`。`requestBody` はコマンド定義、`url` は `/applications/<id>/commands` | 機密値なし(Bot トークンは `Authorization` ヘッダにだけ入り、エラーオブジェクトには載らない) |
| **`index.js:97`** | `[Roulette] トークン生成: ${token} (Guild: …, User: …)` | **アクセストークン全文** | **今回の本題。有効なトークンがそのまま残る** |
| **`index.js:99`** | `console.error('スラッシュコマンド処理エラー:', error)` | `interaction.reply` が失敗したときの `DiscordAPIError` | **要対応。下記参照** |
| **`index.js:114`** | `[Roulette] 期限切れトークンを削除: ${token}` | アクセストークン全文(期限切れ後) | 出力時点では無効だが、同じトークンが97行目にも出ているので突き合わせの手がかりになる。全文を出す理由はない |
| `index.js:199`・`226`・`261` | API ハンドラの `console.error(…, error)` | キャッシュ参照だけなので Discord API エラーは基本的に起きない。トークンは `req` にあるがエラーには入らない | 問題なし |
| `index.js:267` | `Server running on port ${PORT}` | なし | 問題なし |

### `index.js:99` の `DiscordAPIError` に入る値

`@discordjs/rest`(discord.js 14.27.0 が使う版)の `DiscordAPIError` は、コンストラクタで `url`(リクエスト先)と `requestBody = { files, json }`(送ろうとした本文)をプロパティに持つ(`server/node_modules/@discordjs/rest/dist/index.js` の `DiscordAPIError` クラス)。`console.error(..., error)` は Node の `util.inspect` で独自プロパティも出すので、`interaction.reply` が失敗すると次がログに残る。

- `url` … `https://discord.com/api/v10/interactions/<interaction id>/<interaction token>/callback`。インタラクショントークン(15分間、そのインタラクションへの応答・フォローアップの送信に使える)を含む
- `requestBody.json.data.content` … 返信本文。`${rouletteUrl}` = `FRONTEND_URL?token=<アクセストークン全文>` を含む

`interaction.reply` が失敗してもトークンは `accessTokens` に保存済みで有効なため、97行目を直してもこの経路でアクセストークンが残りうる。普段は起きない(3秒の応答期限切れ・Discord 障害時など)が、起きたときに残るのは全文。

さらに、catch 内の `interaction.reply`(100行目)が再び失敗すると、`client.on` のハンドラから例外が漏れて unhandled rejection になり、Node 24 の既定ではプロセスが落ちる(そのときのスタック出力にも同じ `DiscordAPIError` が出る)。機密値の観点では同じ問題なので、あわせて扱う。

### ログ以外の経路(参考)

- フロントエンド(`js/discord-client.js:20`)はアクセストークンをクエリパラメータ `?token=` で送る。Render の HTTP リクエストログは Pro ワークスペース以上の機能で、リクエストの URL(パス)を記録する。クエリ文字列が記録されるかは公式ドキュメントからは読み取れなかった。このプロジェクトのワークスペースのプランも未確認。
- Bot トークン(`DISCORD_BOT_TOKEN`)は `client.login` と `REST#setToken` に渡すだけで、どこにもログ出力していない。

## 選択肢の比較

### 論点1: アクセストークンの出し方(97・114行目)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A: トークンをログから完全に消す | 漏れようがない | 同じトークンの生成・削除・期限切れの対応がログから追えない | |
| 案B: 先頭数文字だけ出す(例: 先頭6文字 + `…`) | 生成と削除の突き合わせができる。実装が1行 | 先頭は秘密の一部。ただし 64 桁の16進のうち 6 桁(24bit)なら残り 232bit が残り、推測の役に立たない | 依頼文の「先頭数文字だけ等に伏せる」と一致 |
| 案C: トークンのハッシュ(SHA-256 の先頭数文字)を出す | 秘密そのものを出さない。突き合わせもできる | 人がログとトークンを手で照合しにくい(フロントの URL と見比べられない) | |

### 論点2: エラーオブジェクトの出し方(99行目、ほかの `console.error` にも横展開するか)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案X: 99行目だけ、`error` の代わりに `name`・`message`・`code`・`status`・`method` と、トークンを伏せた `url` を出す | 原因調査に必要な情報は残る。差分が小さい | エラーを出す箇所ごとに書き分けが要る | `requestBody` は出さない |
| 案Y: 共通のログ用関数(例: `describeError(error)`)を作り、すべての `console.error` で使う | 今後の追加箇所でも同じ扱いになる | 今は問題の無い箇所まで変わる。スタックを出すかの方針も決める必要がある | |
| 案Z: 99行目は触らない | 差分最小 | reply 失敗時にアクセストークン全文とインタラクショントークンが残る | 依頼の「トークン全文がログに出なくなる」を満たさない |

あわせて、catch 内の `interaction.reply` 失敗で unhandled rejection にならないよう、2回目の reply を try/catch で包む(または `.catch` で握り、伏せたログを出す)かどうかも設計で決める。

## 推奨アプローチ

- 論点1は **案B**(先頭6文字 + `…`)。依頼文どおりで、生成と期限切れ削除の行を突き合わせられる。97行目と114行目を同じ伏せ字関数(例: `maskToken(token)`)で出す。
- 論点2は **案Y を小さく**: `DiscordAPIError` から安全なフィールドだけを取り出す関数を用意し、Discord API を呼ぶ箇所の `console.error`(55行目・99行目)で使う。`url` は `/interactions/<id>/<token>/` のトークン部分と `?token=` を伏せる。`requestBody` は出さない。199・226・261行目はキャッシュ参照だけで Discord のエラーオブジェクトが来ないので、そのままでもよいが、同じ関数に揃えるかは設計で判断する。
- catch 内の2回目の `interaction.reply` は失敗を握って伏せたログを出す(unhandled rejection でプロセスが落ちて全文がスタックに出るのを防ぐ)。
- `server/` にはテストが無い。伏せ字関数・エラー要約関数を純粋関数として別ファイル(例: `server/log-safe.js`)に切り出せば、ルートの Jest(`tests/unit/`)から ESM で import して単体テストできる。ルートの Jest の対象・設定がサーバー側のファイルを読めるかは設計で確認する。

## 制約・リスク

- `server/` を変えるので Render の自動デプロイ対象になる。[[render-root-dir-autodeploy]] の未確認事項(`server/` を変えたコミットで自動デプロイが走るか)を、リリース後にデプロイ一覧の Trigger で確かめる。
- 起動確認は [[worktree-server-env-live-token]] に従い、`.env` の無いディレクトリを cwd にし、`DISCORD_BOT_TOKEN` を空にして行う。実 Bot での `/roulette` 確認(ログに全文が出ないこと)は人間が Render 側で、デプロイ後のログで確かめるのが現実的。
- Render に既に残っているログ(過去に発行したトークン全文)は消せない可能性がある。ただしトークンは1時間で失効し、サーバー再起動で `accessTokens`(メモリ)も消えるので、現時点で過去のトークンは使えない。
- Bot トークンはログに出ていないので、ローテーションは不要と判断する(ログ以外の漏洩は今回の範囲外)。

## 未解決の疑問・要確認事項

- Render の HTTP リクエストログ(Pro 以上)に `?token=` のクエリ文字列が残るか。このプロジェクトのワークスペースのプランも含めて未確認。残るならトークンをヘッダ(`x-access-token`、サーバー側は対応済み)で送るようフロントを変える別トピックになる。今回は範囲外として、人間への報告に含める。→ 設計の壁打ちで、プランは Hobby(HTTP リクエストログ無し)と判明したが、予防として今回のスコープに含め、サーバーのクエリ受け付けも廃止することになった(設計ドキュメント参照)。
- 先頭何文字を出すか(推奨は6文字)。

## 参考資料

- `server/index.js`
- `server/node_modules/@discordjs/rest/dist/index.js`(`DiscordAPIError` クラス)
- [Logs in the Render Dashboard](https://render.com/docs/logging)
- [A New Log Explorer and HTTP Logs](https://render.com/blog/new-logs)
- 共有メモリ: [[render-root-dir-autodeploy]]、[[worktree-server-env-live-token]]、[[jest-esm-globals]]

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
