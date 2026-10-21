---
name: discordjs-error-leaks-request
type: pitfall
status: active
related_topics: [token-log-masking]
created: 2026-10-22
updated: 2026-10-22
---

discord.js(`@discordjs/rest`)の `DiscordAPIError` は、失敗したリクエストの `url` と `requestBody`(送ろうとした本文)をプロパティに持つ。`console.error('…', error)` でそのまま出すと Node の inspect が両方を出力するので、`interaction.reply` の失敗では URL 中のインタラクショントークンがログに残る。`requestBody` も出力されるが、既定の表示深さ(2)では `json.data` が `[Object]` に省略されるので、返信本文(このアプリではアクセストークン付きの URL)まで出るのは表示深さを上げた場合や本文の構造が浅い場合に限られる(token-log-masking のテストで確認)。Discord API のエラーをログに出すときは `name`・`message`・`code`・`status`・`method` と伏せた `url` だけを出し、`requestBody` は出さない。

**背景:** token-log-masking の調査で、`/roulette` の catch 節の `console.error` がこの経路でアクセストークン全文を出しうると判明した([調査](../../investigations/2026-10-22-token-log-masking.md))。Bot トークンは `Authorization` ヘッダにだけ入り、エラーオブジェクトには載らない。

**適用範囲:** `server/` で Discord API を呼ぶ処理のエラーログを書くとき。

**関連:** [[worktree-server-env-live-token]]
