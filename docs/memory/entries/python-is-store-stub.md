---
name: python-is-store-stub
type: pitfall
status: active
related_topics: [roulette-animation-behavior]
created: 2026-10-21
updated: 2026-10-21
---

この開発環境(Windows)の Bash で `python` を呼ぶと Microsoft Store のスタブが起動するだけで、スクリプトは実行されない(エラーにならず "Python" と出るだけ)。Python で一括編集したつもりでもファイルは変わらず、変更前のコードでテストが通ってしまう。

ファイル編集は Edit ツールか node のスクリプトで行う。編集後は `git status --short` で実際に変わったことを確かめてから報告する。

**背景:** ルーレット演出の改修で、実装担当2人が Python で編集したつもりになり、1人は変更が無いまま「修正済み」と報告した([テスト](../../tests/2026-10-21-roulette-animation-behavior.md))。

**適用範囲:** すべてのフェーズでのファイル編集・スクリプト実行。

**関連:** なし
