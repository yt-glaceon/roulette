---
name: render-root-dir-autodeploy
type: pitfall
status: active
related_topics: [node24-upgrade, token-log-masking]
created: 2026-10-22
updated: 2026-10-22
---

Render の server サービスは Root Directory が `server` なので、`server/` の外だけを変えたコミット(フロントエンド・docs など)では自動デプロイが走らない(Auto-Deploy は On Commit で有効、Build Filters は空)。`server/` を変えたコミットは main へのマージで自動デプロイされる(Events に「New commit via Auto-Deploy」と出る)。「main にマージしたのに Render が自動デプロイしない」は、まず差分に `server/` が含まれるかを見る。含まれていれば Webhook の遅延を疑い、数分〜数十分待ってから手動デプロイを考える。フロントだけの変更なら Render への反映は不要(GitHub Pages 側だけで足りる)。

反映を外から確かめるには、変更で応答が変わる API を `curl` で叩く(token-log-masking では、新サーバーが `?token=` を読まなくなったので `/api/validate-token?token=dummy` の応答の違いで判定した)。

**背景:** 2026-10-21 のマージ PR #1〜#3・#5・#6 は `server/` を変えておらず、自動デプロイされなかった(Render の設定画面にも「Code changes outside of this directory do not trigger an auto-deploy」とある)。`server/` を変えた PR #4 は、GitHub の Webhook 配信遅延の障害の最中にマージされ、手動デプロイで反映した。その約37分後に同じコミットの自動デプロイが遅れて走った。PR #7(token-log-masking、`server/` を変更)は、マージの約4分後に自動デプロイが始まり、約1分で live になった(2026-10-22 確認)。

**適用範囲:** server/ を変更するトピックのリリース・デプロイ後確認。Render の自動デプロイが走らないときの切り分け。

**適用範囲:** server/ を変更するトピックのリリース・デプロイ後確認。Render の自動デプロイが走らないときの切り分け。

**関連:** [[render-node-version]]
