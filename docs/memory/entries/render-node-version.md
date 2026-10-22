---
name: render-node-version
type: pitfall
status: active
related_topics: [node24-upgrade]
created: 2026-10-21
updated: 2026-10-22
---

Render は Node のバージョンを `NODE_VERSION` 環境変数 > `.node-version` > `.nvmrc` > `package.json` の `engines` の順で決める(engines が最弱)。指定が無いとサービス作成日時点の既定版に固定されたままになる。Root Directory を `server` にしたときは `server/package.json` の engines が読まれる(2026-10-22 実測。ログに `via /opt/render/project/src/server/package.json` と出る。公式には記載なし)。`24.x` はリリース当日の修正版 24.22.1 に解決された。GitHub Actions の `actions/setup-node`(`check-latest: true`)は、配布元 actions/node-versions に修正版が載るまで 1 つ前のパッチ(24.22.0)を使い、載った後の実行から自動で 24.22.1 になった(当日中)。Node の指定を変えたらデプロイログの冒頭で実際の版を必ず確かめる。

**背景:** Node.js の 2026-10-21 セキュリティリリース対応で、server の Node バージョンが未指定と分かった。出典は https://render.com/docs/node-version(2026-10-21 時点)。詳細は `docs/investigations/2026-10-21-node24-upgrade.md`。

**適用範囲:** server/ の Node バージョン・ビルド設定を変えるとき、Render 側の挙動を前提にする設計とテスト。

**関連:** なし
