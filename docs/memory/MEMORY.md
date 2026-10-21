# 共有メモリ Index

すべてのサブエージェント(investigator / designer / implementer / tester)およびオーケストレーションコマンド(`/investigate` `/design` `/implement` `/test` `/cycle`)は、**タスク開始前に必ずこのファイルを読む**。関連しそうなエントリがあれば `entries/<name>.md` を読んで詳細を確認してから作業に入ること。

このファイルは索引のみで、内容そのものは書かない。1エントリ1行、`entries/` 配下の各ファイルへのリンクとして追記する。手動で作った空行区切りのカテゴリ見出しは維持すること。

読み書きのルールは `${CLAUDE_PLUGIN_ROOT}/process/shared-memory.md`(loop-basic プラグイン内) を参照。

## decision(プロジェクト全体の技術的決定)

<!-- 例: - [http-client](entries/http-client.md) — HTTP通信は全topicでfetchに統一、axiosは使わない -->

## convention(命名・実装・テストの規約)

<!-- 例: - [file-naming](entries/file-naming.md) — ファイル名はkebab-case、コンポーネントはPascalCase -->

## pitfall(既知の落とし穴・失敗から得た教訓)

<!-- 例: - [ci-no-network](entries/ci-no-network.md) — CI環境は外部ネットワークにアクセスできない、モック必須 -->
- [import-meta-env-in-jest](entries/import-meta-env-in-jest.md) — Jest では import.meta.env が undefined。env 参照はエントリポイントに寄せ、ロジックは切り出す
- [same-tick-visual-state](entries/same-tick-visual-state.md) — 同じ tick で付けて外した見た目の状態は描画されない。確定の瞬間は時間をずらして見せる
- [absolute-stacked-faces-height](entries/absolute-stacked-faces-height.md) — 2面とも absolute で重ねると高さが伸びない。片面を通常の流れに置く。長い名前のモックで確認
- [python-is-store-stub](entries/python-is-store-stub.md) — Bash の python は Store のスタブで何も実行されない。編集は Edit か node で、git status で反映を確かめる
- [jest-esm-globals](entries/jest-esm-globals.md) — ESM 実行の Jest では jest がグローバルに無い。@jest/globals から import し、モックは prototype の spyOn で
- [render-node-version](entries/render-node-version.md) — Render の Node 指定は NODE_VERSION > .node-version > .nvmrc > engines。変えたらデプロイログで実際の版を確かめる
- [worktree-server-env-live-token](entries/worktree-server-env-live-token.md) — ワークツリーの server/.env は本番トークン。server/ を cwd に起動すると本番 Bot と二重ログインする
- [express-qs-pinned-audit](entries/express-qs-pinned-audit.md) — express@4.22.1 が qs 6.14.2 を固定し、audit fix 後も qs の moderate が 1 件残る。`npm update express --package-lock-only` で直る(確認前に npm ci)

## glossary(プロジェクト固有の用語集)

<!-- 例: - [slug](entries/slug.md) — 本プロジェクトでの「slug」は YYYY-MM-DD-<topic> 形式を指す -->

## open-question(横断的な未解決事項)

<!-- 例: - [auth-strategy](entries/auth-strategy.md) — 認証方式が未決定。複数topicに影響するため要人間判断 -->
