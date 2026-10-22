---
name: worktree-server-env-live-token
type: pitfall
status: promoted-to-skill
related_topics: [node24-upgrade, token-log-masking, cors-exact-match]
created: 2026-10-21
updated: 2026-10-22
---

ワークツリーには `worktree.copyFiles` で本番の `server/.env`(実 Bot トークン)がコピーされる。`server/index.js` は `dotenv.config()` で cwd の `.env` を読むため、`server/` を cwd にして起動すると Render の本番 Bot と同じトークンで二重ログインし、`/roulette` の応答やトークンの保存先が分かれる。エージェントが起動確認するときは `.env` の無いディレクトリを cwd にし、`DISCORD_BOT_TOKEN` にダミー値を入れて login の失敗で落ちないようにする(Git Bash で `DISCORD_BOT_TOKEN=dummy.fake.token node --unhandled-rejections=warn <worktree>/server/index.js`)。空にすると `client.login('')` が TokenInvalid を投げてプロセスが起動直後に落ち、HTTP の確認ができない(token-log-masking で判明)。実トークンでの確認は人間が Render を Suspend してから行う。

**背景:** node24-upgrade の設計レビューで判明(`docs/designs/2026-10-21-node24-upgrade.md` の設計レビュー結果)。

**適用範囲:** server/ を変更するトピックのテスト・手動確認の設計と実施。

**関連:** [[render-node-version]]

**Skill 化:** `.claude/skills/server-dummy-token-run/SKILL.md`(2026-10-22、cors-exact-match のゲート1で承認)
