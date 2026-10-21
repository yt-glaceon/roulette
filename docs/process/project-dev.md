# プロジェクト固有の開発メモ

`/loop-basic:test`・`loop-basic:code-reviewer`・`loop-basic:tester` が読む、このプロジェクト固有の補足。検証コマンドそのものは `.claude/loop.config.json` の `verify` に書く。

## 構成

Discord のボイスチャネルのメンバーからランダムに選ぶルーレットアプリ。2つの npm パッケージに分かれている。

- ルート(フロントエンド): 素の JavaScript(ES Modules)+ Vite。`index.html`・`js/`・`css/`。
  - `js/app-controller.js`・`js/ui-controller.js`・`js/roulette-engine.js`・`js/result-manager.js`・`js/discord-client.js`・`js/config.js`
  - `js/animations/` … ルーレット・スロット・ドラムロール・カードめくりの各演出
- `server/`(バックエンド): Node.js + Express + discord.js。`server/index.js`。依存は `server/package.json` で別管理。
- `tests/unit/` … Jest(jsdom)+ fast-check のユニットテスト。
- TypeScript・Lint・型チェックは未導入。

## 起動・動作確認の方法

- フロントエンド: ルートで `npm run dev`(Vite の開発サーバー)。
- バックエンド: `server/` で `npm run dev`(または `npm start`)。Discord Bot のトークン等が `server/.env` に必要。
- 詳しい手順は `README.md`・`SETUP.md` を参照。
- `.env`(ルート)と `server/.env` は git 管理外。worktree 作成時に `worktree.copyFiles` で元のリポジトリからコピーされる。中身を会話やドキュメントに書き出さないこと。

## 検証コマンドの補足

- `npm test` … `node --experimental-vm-modules` 経由で Jest を実行する(ES Modules のため)。
- `npm run build` … Vite で `dist/` にビルドする。本番デプロイと同じビルドが通るかの確認になる。
- server/ にはテストがない。server/ を変更するトピックでは、起動確認や `curl` での手動確認が必要。

## 注意点

- `main` へのマージ = GitHub Pages への本番デプロイ(フロントエンドのみ)。`stagingBranch` は無いので、マージ前にトピックの worktree で人間が動作確認する。
- `.kiro/specs/` に過去の Kiro による要件・設計・タスクの記録がある。調査・設計フェーズでは既存の仕様として参照する(移動・編集はしない)。
