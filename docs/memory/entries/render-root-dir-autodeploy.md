---
name: render-root-dir-autodeploy
type: pitfall
status: active
related_topics: [node24-upgrade, token-log-masking]
created: 2026-10-22
updated: 2026-10-22
---

Render の server サービスは Root Directory が `server` なので、`server/` の外だけを変えたコミット(フロントエンド・docs など)では自動デプロイが走らない(Auto-Deploy は On Commit で有効、Build Filters は空)。「main にマージしたのに Render が自動デプロイしない」は、まず差分に `server/` が含まれるかを見る。フロントだけの変更なら Render への反映は不要(GitHub Pages 側だけで足りる)。

**背景:** 2026-10-21 のマージ PR #1〜#3 は `server/` を変えておらず、自動デプロイされなかった(Render の設定画面にも「Code changes outside of this directory do not trigger an auto-deploy」とある)。`server/` を変えた PR #4 も自動デプロイされなかったが、同時間帯に GitHub の Webhook 配信遅延の障害があり、手動デプロイで反映した。**`server/` を変えたコミットで自動デプロイが走ることは未確認**なので、次に `server/` を変えたときにデプロイ一覧の Trigger を確認する。

**適用範囲:** server/ を変更するトピックのリリース・デプロイ後確認。Render の自動デプロイが走らないときの切り分け。

**関連:** [[render-node-version]]
