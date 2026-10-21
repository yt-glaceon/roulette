---
name: express-qs-pinned-audit
type: pitfall
status: active
related_topics: [node24-upgrade]
created: 2026-10-21
updated: 2026-10-21
---

server で `npm audit fix`(`--force` なし)をしても、express@4.22.1 が直下の qs を 6.14.2 に固定しているため、qs の moderate 指摘が 1 件残る(body-parser 配下の qs だけ上がる)。何度 `audit fix` しても消えないので、解消には express 自体の更新(Express 4 の新パッチか Express 5)が必要。

**背景:** node24-upgrade のステップ5で判明(2026-10-21)。critical / high はこの時点で 0 件になった。

**適用範囲:** server の依存更新・脆弱性対応をするとき、残った qs の指摘の扱いを判断する場面。

**関連:** [[worktree-server-env-live-token]]
