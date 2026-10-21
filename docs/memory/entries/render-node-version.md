---
name: render-node-version
type: pitfall
status: active
related_topics: [node24-upgrade]
created: 2026-10-21
updated: 2026-10-21
---

Render は Node のバージョンを `NODE_VERSION` 環境変数 > `.node-version` > `.nvmrc` > `package.json` の `engines` の順で決める(engines が最弱)。指定が無いとサービス作成日時点の既定版に固定されたままになる。Root Directory を `server` にしたときにどこのファイルが読まれるかは公式に書かれていないので、Node の指定を変えたらデプロイログの冒頭で実際の版を必ず確かめる。

**背景:** Node.js の 2026-10-21 セキュリティリリース対応で、server の Node バージョンが未指定と分かった。出典は https://render.com/docs/node-version(2026-10-21 時点)。詳細は `docs/investigations/2026-10-21-node24-upgrade.md`。

**適用範囲:** server/ の Node バージョン・ビルド設定を変えるとき、Render 側の挙動を前提にする設計とテスト。

**関連:** なし
