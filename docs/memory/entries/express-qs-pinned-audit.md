---
name: express-qs-pinned-audit
type: pitfall
status: active
related_topics: [node24-upgrade]
created: 2026-10-21
updated: 2026-10-21
---

server で `npm audit fix`(`--force` なし)をしても、express@4.22.1 が直下の qs を 6.14.2 に固定しているため、qs の moderate 指摘が 1 件残る(body-parser 配下の qs だけ上がる)。何度 `audit fix` しても消えない。ただし express@4.22.3(`qs ~6.16.0`)が `^4.18.2` の範囲内で公開済みなので、`server/` で `npm update express --package-lock-only` を実行すれば package.json を変えずに解消できる見込み(2026-10-21 コードレビューで `npm view` により確認。未実施)。

**背景:** node24-upgrade のステップ5で判明(2026-10-21)。critical / high はこの時点で 0 件になった。

**適用範囲:** server の依存更新・脆弱性対応をするとき、残った qs の指摘の扱いを判断する場面。

**関連:** [[worktree-server-env-live-token]]
