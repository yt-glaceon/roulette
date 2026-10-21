---
name: import-meta-env-in-jest
type: pitfall
status: active
related_topics: [dev-mock-members]
created: 2026-10-21
updated: 2026-10-21
---

`import.meta.env` は Vite が注入するもので、Jest(`--experimental-vm-modules` の ESM 実行)では `undefined` になる。`import.meta.env` を参照するモジュールはテストから直接 import しにくいので、判定ロジックやデータは `import.meta.env` に依存しないモジュールに切り出し、env の参照はエントリポイント側(`app-controller.js` 等)に寄せる。

**背景:** 既存の `js/config.js` がこの理由でカバレッジ対象外になっている。開発用モックの調査で確認([調査](../../investigations/2026-10-21-dev-mock-members.md))。

**適用範囲:** フロントの設計・実装で環境変数やモードによる分岐を入れるとき。

**関連:** なし
