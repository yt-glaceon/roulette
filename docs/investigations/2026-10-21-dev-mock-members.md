# 調査: 開発用のダミーメンバー(モック)で Discord なしに動作確認できるようにする

- 日付: 2026-10-21
- ステータス: 完了
- 関連する設計ドキュメント: [2026-10-21-dev-mock-members.md](../designs/2026-10-21-dev-mock-members.md)

## 背景・目的

今は動作確認のたびに Discord のボイスチャネルへ実際に入る必要がある。開発者が1人だとメンバーも1人しかおらず、ルーレット(複数人から選ぶ)として検証にならない。Discord・Bot・バックエンドなしでも、複数人のメンバーでルーレットを試せる手段を用意したい。

調査前にユーザーと決めた前提:

- **開発専用**。本番ビルド(GitHub Pages)には含めない
- **フロントだけで完結**させる。`DiscordClient` と同じ形のモッククライアントに差し替える
- **複数のプリセット**(人数や極端なケース)を用意し、人数も指定できるようにする
- サーバー再起動でトークンが消える問題は**対象外**(別トピック)

## 現状の把握

### フロントとバックエンドの境目

- `js/app-controller.js` は `DiscordClient`(`js/discord-client.js`)の4メソッドだけを使う。
  - `validateToken()` → `{ valid: true, guildId }`
  - `getGuild()` → `{ id, name, icon }`
  - `getChannels()` → `[{ id, name, position, memberCount }]`(`server/index.js` で position 順にソート済み)
  - `getVoiceChannelMembers(channelId)` → `[{ id, username, displayName, avatar }]`
- エラーは `{ type, status, message }` 形式の素のオブジェクトを throw する(`AUTH_ERROR` / `NOT_FOUND` / `SERVER_ERROR` / `API_ERROR` / `NETWORK_ERROR`)。`AppController.handleApiError` がこれを見て表示を分ける。
- `AppController.initialize()` は URL の `?token=` が無いと即エラー表示して終わる。トークンがあれば `new DiscordClient(token)` → `validateToken()` → `loadGuildAndChannels()`。
- `AppController` はモジュール末尾で `new AppController().initialize()` を実行しており、Jest のカバレッジ対象外(`jest.config.js` で除外)。テストからは直接扱いにくい。

### 表示側がメンバーに期待すること

- `ui-controller.js`・`animations/*` は `member.displayName` と `member.avatar` を使う。`avatar` が falsy なら `displayName.charAt(0)` を表示する(アバター無しのケースは既に表示できる)。
- チャネル一覧は `channel.memberCount ?? 0` を表示する。
- 0人のチャネルを選ぶと `AppController.handleChannelSelection` が「メンバーがいません」エラーを出す。

### ビルドと環境変数

- Vite 5。`vite.config.js` に `envPrefix: 'VITE_'`。`js/config.js` が `import.meta.env.VITE_API_URL` を読む。
- `npm run build` は `vite build`(production モード)。`main` への push で GitHub Pages にデプロイされる。
- 本番ビルドでは `import.meta.env.DEV` が `false` に静的置換されるため、`if (import.meta.env.DEV) { await import('./mock/...') }` と書けば分岐ごと消え、動的 import 先のチャンクも出力されない(Vite/Rollup の dead code elimination)。

### テスト

- Jest(jsdom)を `--experimental-vm-modules` で ESM として実行。`import.meta.env` は Vite が注入するものなので、Jest 上では `undefined`。`import.meta.env` を参照するモジュールはテストから直接 import しにくい(既存の `config.js` もカバレッジ対象外)。
- 既存テストのメンバーデータはテストファイルごとに直書き。

### 既存資料

- `.kiro/specs/` にモック・デモモードに関する既存仕様は無い。

## 選択肢の比較

### 1. モックの層(ユーザー回答で A に決定済み、比較として記録)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| A: フロント内で `MockDiscordClient` に差し替え | Bot・バックエンド不要で `npm run dev` だけで動く。差し替え箇所が1か所 | 実 API・CORS・トークン期限切れは確認できない | **採用** |
| B: バックエンドにモックモード | 通信まで確認できる | server はテスト・自動デプロイなし。本番で誤って有効になる危険 | |
| C: 実 API の結果にダミーを追加 | 本物と一緒に確認できる | Discord 必須のまま | |

### 2. モックの有効化方法(本番に含めない仕組み)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| a: 開発サーバー時のみ `?mock` パラメータで有効化(`import.meta.env.DEV && params.has('mock')`) | 起動コマンドはそのまま。URL だけで実モード/モックを切り替えられる。本番ビルドでは分岐ごと消える | URL を覚える必要がある(トークン無しエラー画面にリンクを出せば解消) | 推奨 |
| b: 専用モード `vite --mode mock`(`npm run dev:mock`)で `import.meta.env.MODE === 'mock'` | 起動コマンドで明確に分かれる | 実モードとの切り替えにサーバー再起動が要る。`build --mode mock` すればモック入りビルドも作れてしまう | |
| c: `.env.development.local` 等の `VITE_USE_MOCK=true` | 一度設定すれば毎回有効 | 状態が見えにくく、実モードで確認したいときに戻し忘れる | |

### 3. プリセットと人数指定の渡し方

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| i: プリセットを「モックのボイスチャネル」として一覧に並べる + `?mock=<人数>` で「人数指定チャネル」を追加 | 既存のチャネル選択画面がそのまま使え、新しい UI が不要。チャネル選択→メンバー表示の実フローを通る | 人数指定は URL 編集が必要 | 推奨 |
| ii: 開発用パネル(画面上で人数・名前を編集) | 自由度が高い | UI 実装量が増え、本番から確実に除く範囲も増える | ユーザー回答で不採用 |

## 推奨アプローチ

- `js/dev/mock-discord-client.js`(仮)に `MockDiscordClient` を作り、`DiscordClient` と同じ4メソッドを同じ形で返す(`Promise` を返し、少し遅延を入れてローディング表示も確認できるようにする)。
- プリセットデータは純粋なデータ/関数のモジュール(例: `js/dev/mock-data.js`)に分け、`import.meta.env` に依存させない。Jest で形や人数を検証できる。
- `AppController.initialize()` で `import.meta.env.DEV` かつ `?mock` があるときだけ、動的 import で `MockDiscordClient` を生成する。トークンチェックはスキップする。本番ビルドでは分岐ごと消える。
- プリセットはモックのボイスチャネルとして並べる。候補:
  - 通常(8人)
  - 大人数(30人)
  - 長い名前・絵文字・アバター無しの混在
  - 1人
  - 0人(エラー表示の確認)
  - `?mock=<N>` 指定時: N 人のチャネル
- アバターは外部 URL を使わず `null`(頭文字表示)か、インラインの data URI(SVG)にする。オフラインでも動き、外部サービスへのリクエストも発生しない。
- 画面上にモック中であることが分かる表示(バッジ等)を出す。実データと取り違えないため。
- 本番ビルドに残っていないことを `npm run build` 後に `dist/` を検索して確認する(テスト手順に含める)。

## 制約・リスク

- **本番への混入**: `import.meta.env.DEV` の分岐の外から mock モジュールを静的 import すると本番バンドルに入る。静的 import を禁止し、`dist/` 検索で確認する必要がある。
- **履歴の混入**: `ResultManager.saveToHistory` は localStorage に保存する。モックの結果が開発ブラウザの履歴に混ざる(開発サーバーの origin は本番と異なるので本番の履歴には混ざらない)。許容するか、guildId を `mock-guild` 等にして区別するか設計で決める。
- **形の乖離**: 実 API のレスポンス形式が変わったときにモックが追随しない恐れ。モックは `server/index.js` の形に合わせる旨をコメントで明記する。
- **テストのしにくさ**: `app-controller.js` は import 時に `initialize()` が走りテストしにくい。切り替え判定を小さな関数に切り出すか、手動確認で担保するか設計で決める。
- **CORS**: モックは fetch しないため影響なし。

## 未解決の疑問・要確認事項

- 有効化パラメータの名前(`?mock` / `?demo` 等)と、人数指定の書式(`?mock=12`)。
- トークン無しエラー画面に、開発時だけ「モックで開く」リンクを出すか。
- モックの結果を履歴に保存するか(保存するなら区別できる guildId にする)。
- 名前のランダム性(固定リストか、シード付き生成か)。演出確認では毎回同じ名前の方が比較しやすい。
- `?mock=<N>` の上限(例: 1〜100)と、不正値の扱い。

## 参考資料

- `js/app-controller.js`、`js/discord-client.js`、`js/ui-controller.js`、`server/index.js`
- Vite 公式ドキュメント「Env Variables and Modes」(`import.meta.env.DEV` は本番ビルドで静的置換される)

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
