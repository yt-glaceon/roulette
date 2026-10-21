# テストレポート: 開発用のダミーメンバー(モック)で Discord なしに動作確認できるようにする

- 日付: 2026-10-21
- ステータス: 承認・クローズ済み
- 対応する設計ドキュメント: [docs/designs/2026-10-21-dev-mock-members.md](../designs/2026-10-21-dev-mock-members.md)

## テスト対象

設計の実装ステップ1〜7 すべて。

- `js/dev/mock-data.js`・`js/dev/mock-discord-client.js`・`js/dev/mock-badge.js`(新規)
- `js/app-controller.js`(`import.meta.env.DEV && ?mock` で動的 import に切り替え、開発時のみ案内文)
- `tests/unit/mock-*.test.js`(新規)、`docs/process/project-dev.md`(使い方)

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 自動テスト | `npm test`: 10 スイート・93 件(うち新規: mock-data / mock-discord-client / mock-badge) | pass |
| ビルド | `npm run build` | pass |
| ビルド検査 | `grep -rlE '【モック】\|mock-badge\|MockDiscordClient' dist --include='*.js' --include='*.html'` が 0 件。`dist/assets` は `index-*.js`・`.map`・`.css` のみで mock チャンク無し。開発時の案内文(`ダミーメンバー`・`?mock`)も本番 JS に 0 件 | pass |
| 型チェック/Lint | 未構成(`verify.lint`・`verify.typecheck` が null) | 対象外 |
| 手動確認(ゴールデンパス) | `?mock=12` でバッジとプリセット5+指定人数チャネルが出る/通常(8人)で1人除外・3人選出・円形ルーレット → 結果表示 → 履歴に `mock-guild` で保存/大人数(30人)でスロット・5人選出 | pass |
| 手動確認(エッジケース) | 0人チャネルで「メンバーがいません」/長い名前・絵文字・記号・HTML 特殊文字の表示/`?mock=abc` でプリセットのみ/`?mock=12&token=dummy` でモック優先/パラメータ無しで案内文付きエラー | pass(既存不具合1件を発見、下記) |

## 証跡(手動確認分)

ブラウザ(Vite 開発サーバー、`http://localhost:5500/roulette/`)のスクリーンショット。`docs/tests/assets/2026-10-21-dev-mock-members/` に保存。

- [01-channel-list.jpg](assets/2026-10-21-dev-mock-members/01-channel-list.jpg) … `?mock=12`。右上に MOCK MODE、指定人数(12人)が先頭
- [02-normal-members.jpg](assets/2026-10-21-dev-mock-members/02-normal-members.jpg) … 通常(8人)のメンバー
- [03-wheel-done.jpg](assets/2026-10-21-dev-mock-members/03-wheel-done.jpg) … あおいを除外した7人で円形ルーレット完了
- [04-result.jpg](assets/2026-10-21-dev-mock-members/04-result.jpg) … 3人の選出結果(除外したあおいは含まれない)
- [05-slot-large.jpg](assets/2026-10-21-dev-mock-members/05-slot-large.jpg) … 大人数(30人)でスロット完了
- [06-empty-error.jpg](assets/2026-10-21-dev-mock-members/06-empty-error.jpg) … 0人チャネルのエラー
- [07-edge-names.jpg](assets/2026-10-21-dev-mock-members/07-edge-names.jpg) … 長い名前・絵文字・記号。絵文字始まりの頭文字が「�」になる
- [08-no-token-hint.jpg](assets/2026-10-21-dev-mock-members/08-no-token-hint.jpg) … パラメータ無しのエラーに開発時の案内文

localStorage の履歴(抜粋): `{"guildId":"mock-guild","channelId":"mock-normal","totalMembers":8,"selectedCount":3,...}`

## 不合格・不具合の詳細

今回の変更による不合格は無し。

モックで見つかった**既存の**不具合(設計どおりスコープ外。別トピックで扱う):

- 絵文字で始まる名前のアバター無しメンバーで、頭文字が「�」になる
  - 再現: `?mock` → 【モック】長い名前・絵文字・アバター無し → `🎮ゲーム好きのユーザー`・`🍣🍣🍣`
  - 原因: `ui-controller.js` などが `displayName.charAt(0)` でサロゲートペアの片割れだけを取っている
  - 影響: 実 API ではアバターが常に URL で返るため、本番ではほぼ起きない(コードレビューの MINOR 指摘と同じ)

## 未検証の観点・既知の制限事項

- カードめくり・ドラムロールの演出はモックで手動確認していない(演出側は今回変更なし。円形・スロットで、モックのデータで演出が動くことは確認済み)
- 結果のクリップボードコピーは未確認(変更なし)
- 実 API(`?token=...`)での動作は、Bot を起動していないため未確認。`app-controller.js` の else 分岐は既存処理のままで、差分上も変更なし
- 本番ビルドでの `?mock` の無効化は、ビルド成果物の検索で確認した(`vite preview` での実画面確認はしていない)

## コードレビューからの引き継ぎ

なし(ラウンド1 PASS、MINOR 2件は対応不要と判断)

## 総合判定

合格

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 承認してクローズ | 総合判定 合格のまま承認 |
