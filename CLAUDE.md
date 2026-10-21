# roulette

Discord のボイスチャネルのメンバーからランダムに選ぶルーレットアプリ。構成と開発方法は `docs/process/project-dev.md` を参照。

## 開発サイクル(loop-basic)

このリポジトリの開発対象(`.claude/loop.config.json` の `productPaths`)を変更するときは、依頼の言い方にかかわらず loop-basic プラグインの開発サイクル(`/loop-basic:cycle`)に従う。最上位ルールはセッション開始時にプラグインから読み込まれる。読み込まれていない場合は loop-basic プラグインの `process/core-rules.md` を読んでから作業する。
