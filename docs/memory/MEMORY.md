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

## glossary(プロジェクト固有の用語集)

<!-- 例: - [slug](entries/slug.md) — 本プロジェクトでの「slug」は YYYY-MM-DD-<topic> 形式を指す -->

## open-question(横断的な未解決事項)

<!-- 例: - [auth-strategy](entries/auth-strategy.md) — 認証方式が未決定。複数topicに影響するため要人間判断 -->
