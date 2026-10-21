# プロジェクト固有の開発メモ

`/loop-basic:test`・`loop-basic:code-reviewer`・`loop-basic:tester` が読む、このプロジェクト固有の補足。検証コマンドそのものは `.claude/loop.config.json` の `verify` に書く。

## 構成

Discord のボイスチャネルのメンバーからランダムに選ぶルーレットアプリ。2つの npm パッケージに分かれている。

- ルート(フロントエンド): 素の JavaScript(ES Modules)+ Vite。`index.html`・`js/`・`css/`。
  - `js/app-controller.js`・`js/ui-controller.js`・`js/roulette-engine.js`・`js/result-manager.js`・`js/discord-client.js`・`js/config.js`
  - `js/animations/` … ルーレット・スロット・ドラムロール・カードめくりの各演出
    - `animation-timing.js` … 演出の時間配分と停止位置を計算する純粋関数
- `server/`(バックエンド): Node.js + Express + discord.js。`server/index.js`。依存は `server/package.json` で別管理。
- `tests/unit/` … Jest(jsdom)+ fast-check のユニットテスト。
- TypeScript・Lint・型チェックは未導入。

## 起動・動作確認の方法

- フロントエンド: ルートで `npm run dev`(Vite の開発サーバー)。
- バックエンド: `server/` で `npm run dev`(または `npm start`)。Discord Bot のトークン等が `server/.env` に必要。
- Discord なしで確認するモック: `npm run dev` → `http://localhost:5500/roulette/?mock`(プリセット5チャネル)/ `?mock=12`(12人のチャネルを先頭に追加。1〜100)。
  - 開発サーバー専用。本番ビルドと `vite preview` では無効。`?token` と併用した場合はモック優先。
  - プリセット: 通常(8人)/ 大人数(30人)/ 長い名前・絵文字・アバター無し(6人)/ 1人 / 0人。
  - モックでは確認できないこと: 実 API・CORS・トークン期限切れ。これらに関わる変更は実環境(Bot 起動)で確認する。
  - 本番ビルドにモックが含まれていないことの確認: `npm run build` 後に `dist/` の `*.js`・`*.html`(`*.map` は対象外)に `【モック】`・`mock-badge` が無く、`dist/assets/` に名前に `mock` を含むファイルが無いこと。
    - PowerShell: `Get-ChildItem dist -Recurse -Include *.js,*.html | Select-String '【モック】|mock-badge'` が 0 件
    - bash: `grep -rlE '【モック】|mock-badge' dist --include='*.js' --include='*.html'` が 0 件
- 詳しい手順は `README.md`・`SETUP.md` を参照。
- `.env`(ルート)と `server/.env` は git 管理外。worktree 作成時に `worktree.copyFiles` で元のリポジトリからコピーされる。中身を会話やドキュメントに書き出さないこと。

## 検証コマンドの補足

- `npm test` … `node --experimental-vm-modules` 経由で Jest を実行する(ES Modules のため)。
- `npm run build` … Vite で `dist/` にビルドする。本番デプロイと同じビルドが通るかの確認になる。
- server/ にはテストがない。server/ を変更するトピックでは、起動確認や `curl` での手動確認が必要。

## 注意点

- `main` へのマージ = GitHub Pages への本番デプロイ(フロントエンドのみ)。`stagingBranch` は無いので、マージ前にトピックの worktree で人間が動作確認する。
- `.kiro/specs/` に過去の Kiro による要件・設計・タスクの記録がある。調査・設計フェーズでは既存の仕様として参照する(移動・編集はしない)。
