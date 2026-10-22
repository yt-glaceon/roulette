---
name: server-dummy-token-run
description: このリポジトリのバックエンド(server/index.js)をワークツリーで起動して動作確認するとき(curl で API・CORS・ヘルスチェックを確かめるなど)に使う。ワークツリーの server/.env は本番トークンなので、ダミートークンで起動する手順をまとめる。
---

# server-dummy-token-run: ダミートークンでバックエンドを起動して確かめる

ワークツリーには `worktree.copyFiles` で本番の `server/.env`(実 Bot トークン)がコピーされる。`server/index.js` は `dotenv.config()` で cwd の `.env` を読むので、`server/` を cwd にして起動すると Render の本番 Bot と同じトークンで二重ログインし、`/roulette` の応答やアクセストークンの保存先が分かれてしまう。

## 手順

1. `.env` の無いディレクトリ(例: スクラッチパッド)を cwd にする。`server/` やリポジトリのルートを cwd にしない。
2. `DISCORD_BOT_TOKEN` にダミー値を入れ、login の失敗でプロセスが落ちないよう `--unhandled-rejections=warn` を付けて起動する(Git Bash、バックグラウンド実行):

   ```bash
   PORT=3999 DISCORD_BOT_TOKEN=dummy.fake.token node --unhandled-rejections=warn <worktree>/server/index.js
   ```

   空文字にすると `client.login('')` が TokenInvalid を投げ、起動直後に落ちて HTTP の確認ができない。
3. curl で確かめる。Bot は未ログインなので `GET /` は `bot: "not ready"` を返す。`/api/*` はアクセストークンが要り、Discord のデータは取れない(401 までの確認になる)。
4. 終わったらプロセスを止める。
5. 実トークンでの確認(実際の Discord データ・`/roulette` コマンド)が必要なら、人間に Render のサービスを Suspend してもらってから人間が行う。

## 元になった共有メモリ

`docs/memory/entries/worktree-server-env-live-token.md`(node24-upgrade・token-log-masking・cors-exact-match で再利用)
