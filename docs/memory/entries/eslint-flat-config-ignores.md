---
name: eslint-flat-config-ignores
type: pitfall
status: active
related_topics: [ci-actions]
created: 2026-10-22
updated: 2026-10-22
---

ESLint の flat config は `.gitignore` を読まない。既定の除外は `**/node_modules/` と `.git/` だけなので、`dist/`・`coverage/`・`.claude/`(特に `.claude/worktrees/` に全コピーが入る)は `globalIgnores` で明示する。忘れると worktree 内の別コピーまで lint して件数が膨らむ。

ESLint 10 では `eslint:recommended` に `no-unassigned-vars`・`no-useless-assignment`・`preserve-caught-error` が加わり、`no-unused-vars` は `catch (e)` の未使用も報告する(`caughtErrors: "all"`)。既存コードに初めて入れるときはこの 4 つが出やすい。

**背景:** CI 追加の調査で確認([調査](../../investigations/2026-10-22-ci-actions.md))。件数の実測は未実施。

**適用範囲:** ESLint の設定・導入・設定変更。

**関連:** なし
