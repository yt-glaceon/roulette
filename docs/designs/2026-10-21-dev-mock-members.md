# 設計: 開発用のダミーメンバー(モック)で Discord なしに動作確認できるようにする

- 日付: 2026-10-21
- ステータス: 承認済み
- 対応する調査ドキュメント: [docs/investigations/2026-10-21-dev-mock-members.md](../investigations/2026-10-21-dev-mock-members.md)
- 承認者: yt-glaceon
- 承認日: 2026-10-21

## 目的・スコープ

開発者1人でも、Discord・Bot・バックエンドなしで、複数人のメンバーを相手にルーレットの全フロー(チャネル選択 → メンバー表示 → 除外・人数・ロール → 演出 → 結果・コピー・履歴)を確認できるようにする。

### やること

- 開発サーバー(`npm run dev`)で URL に `?mock` を付けたときだけ、`DiscordClient` の代わりに `MockDiscordClient` を使う
- プリセットのモックボイスチャネル(通常8人/大人数30人/長い名前・絵文字・アバター無し/1人/0人)を用意する
- `?mock=<N>` で N 人のチャネルを一覧の先頭に追加する
- モック中であることが分かるバッジを画面に出す
- 開発時、トークン無しのエラー画面に `?mock` の案内を出す
- モックデータとモッククライアントの単体テストを書く
- 本番ビルドにモックが含まれないことを確認する手順を決める

### やらないこと(スコープ外)

- 本番(GitHub Pages)でのデモモード、手動でのメンバー追加
- バックエンド(`server/`)の変更、トークン永続化
- 画面上でダミーメンバーを編集する開発用パネル
- プリセットで見つかった既存の表示不具合の修正(例: 絵文字始まりの名前で `charAt(0)` が文字化けする等)。見つけたらテストレポートに記録し、別トピックにする

## アーキテクチャ・変更概要

`import.meta.env` を参照するのは `js/app-controller.js` だけにし、モック本体は `import.meta.env` に依存しないモジュールにする(Jest で直接テストするため。[[import-meta-env-in-jest]])。モック関連は新設の `js/dev/` にまとめる(既存の `js/animations/` と同じ、機能単位のサブディレクトリ)。

### 新規: `js/dev/mock-data.js`(純粋なデータ・関数)

- `MOCK_GUILD` … `{ id: 'mock-guild', name: '【モック】開発用サーバー', icon: null }`
- `MOCK_COUNT_MIN = 1`、`MOCK_COUNT_MAX = 100`
- `parseMockCount(value)` … `?mock` の値(文字列 or `null`)を受け取り、`MOCK_COUNT_MIN`〜`MOCK_COUNT_MAX` の整数なら数値、それ以外(空文字・`null`・非数値・小数・範囲外)は `null` を返す
- `createMockMembers(count, { channelKey, names, noAvatar } = {})` … `count` 人のメンバー配列を返す。`channelKey` は id の接頭辞に使う(既定 `'default'`)。`names` を渡すとその名前リストを先頭から使う(edge チャネル用)。`noAvatar: true` なら全員 `avatar: null`。形は実 API と同じ `{ id, username, displayName, avatar }`。名前は固定の候補リストから決定的に作り(毎回同じ並び)、候補を超えたら連番を付ける。id はチャネル内・チャネル間で重複しない文字列(例: `mock-<channelKey>-<n>`)。アバターは一部を data URI の SVG(色付きの円+頭文字)、一部を `null`(頭文字表示の確認用)にする。外部 URL は使わない
- `buildMockChannels(customCount)` … チャネル定義の配列 `[{ id, name, position, members }]` を返す
  - `mock-normal` 【モック】通常(8人)
  - `mock-large` 【モック】大人数(30人)
  - `mock-edge` 【モック】長い名前・絵文字・アバター無し(6人。40文字超の名前、絵文字で始まる名前、記号を含む名前。全員 `avatar: null`)
  - `mock-single` 【モック】1人
  - `mock-empty` 【モック】0人
  - `customCount` が数値なら `mock-custom` 【モック】指定人数(N人)を先頭(position 0)に追加
- チャネル名・ギルド名には必ず `【モック】` を含める(本番ビルド検査の目印にも使う)
- ファイル先頭に「形は `server/index.js` のレスポンスに合わせる」とコメントする

### 新規: `js/dev/mock-discord-client.js`

- `class MockDiscordClient` … コンストラクタ `(channels, { delayMs = 300 } = {})`。`DiscordClient` と同じ4メソッドを `Promise` で返す。各メソッドは `delayMs` 待ってから返す(ローディング表示を確認できるように。テストでは `0`)
  - `validateToken()` → `{ valid: true, guildId: MOCK_GUILD.id }`
  - `getGuild()` → `MOCK_GUILD` のコピー
  - `getChannels()` → `{ id, name, position, memberCount }` の配列(position 昇順。`memberCount` は `members.length`)
  - `getVoiceChannelMembers(channelId)` → そのチャネルのメンバー配列のコピー。未知の id は `{ type: 'NOT_FOUND', status: 404, message: 'リソースが見つかりません。' }` を throw(`DiscordClient` と同じエラー形式)
- `createMockDiscordClient(searchParams, options)` … `URLSearchParams` から `parseMockCount(searchParams.get('mock'))` → `buildMockChannels` → `new MockDiscordClient(...)` を行う工場関数
- 返す値は毎回コピーにし、呼び出し側が書き換えてもモックの元データが変わらないようにする

### 新規: `js/dev/mock-badge.js`

- `showMockBadge(doc = document)` … 画面右上に固定表示の「MOCK」バッジ(要素 id `mock-badge`)を追加する。スタイルはインラインで指定し、`css/style.css` は変更しない(本番 CSS にモック用の記述を残さないため)。二重に呼ばれても1つしか出さない

### 変更: `js/app-controller.js`

- `initialize()` の冒頭(トークン取得の直後)に分岐を追加する:
  - `import.meta.env.DEV && params.has('mock')` のとき、`await import('./dev/mock-discord-client.js')` と `await import('./dev/mock-badge.js')` で動的 import し、`this.discordClient = createMockDiscordClient(params)`、`showMockBadge()` を行う。トークン無しチェックはスキップし、以降(`validateToken` → `setupEventListeners` → `loadGuildAndChannels`)は既存の流れをそのまま通す
  - `?token` と `?mock` が両方あるときもモックを優先し、`?token` は無視する
  - それ以外は既存の処理(トークン必須 → `new DiscordClient(token)`)
  - 動的 import が失敗した場合は既存の try/catch に流れ、エラー表示になる(特別な処理は加えない)
  - ビルド検査で分岐が消えていなかった場合のフォールバック: `if (import.meta.env.DEV) { if (params.has('mock')) { ... } }` の入れ子に書き換える
- トークン無しエラーのメッセージに、`import.meta.env.DEV` のときだけ「開発時は URL に ?mock を付けるとダミーメンバーで確認できます(例: ?mock=12)」を追記する
- **`js/dev/` を静的 import してはならない。** 必ず `import.meta.env.DEV` の分岐の中で動的 import する(本番ビルドで分岐ごと消え、チャンクも出力されないようにするため)

### 変更なし

- `js/discord-client.js`・`js/ui-controller.js`・アニメーション・`server/`・`index.html`・`css/style.css`
- 履歴(`ResultManager.saveToHistory`)はそのまま保存する。guildId が `mock-guild`、チャネル id が `mock-*` になるので実データと区別できる。開発サーバーは本番と origin が違うため、本番の履歴には混ざらない

### 使い方(`docs/process/project-dev.md` に追記する)

- `npm run dev` → `http://localhost:5500/roulette/?mock`(プリセットのみ)/ `?mock=12`(12人のチャネルを追加)

## 実装ステップ

- [ ] ステップ1: `js/dev/mock-data.js` を作る(`MOCK_GUILD`・`parseMockCount`・`createMockMembers`・`buildMockChannels`)
- [ ] ステップ2: `tests/unit/mock-data.test.js` を作る(下記テスト戦略の項目。fast-check は既存テストと同じく `import fc from 'fast-check'`)
- [ ] ステップ3: `js/dev/mock-discord-client.js` を作る(ステップ1に依存)
- [ ] ステップ4: `tests/unit/mock-discord-client.test.js` を作る(ステップ3に依存)
- [ ] ステップ5: `js/dev/mock-badge.js` を作り、`tests/unit/mock-badge.test.js` を作る(他と独立)
- [ ] ステップ6: `js/app-controller.js` に `?mock` の分岐と開発時の案内文を追加する(ステップ3・5に依存)
- [ ] ステップ7: `docs/process/project-dev.md` の「起動・動作確認の方法」にモックの使い方と、本番ビルドに含まれていないことの確認方法を追記する

## テスト戦略

**自動テストを新規作成するか:** する(理由: モックのデータ・クライアントは `import.meta.env` に依存しない純粋なモジュールにしたので Jest で直接検証できる。モックの形が実 API とずれると、モックで確認した内容が当てにならなくなるため、形を自動テストで固定する)

単体テスト(Jest、`tests/unit/`):

- `mock-data.test.js`
  - `parseMockCount`: `'12'`→12、`'1'`→1、`'100'`→100、`''`・`null`・`'abc'`・`'0'`・`'101'`・`'-3'`・`'2.5'`→`null`
  - `createMockMembers(n)`: 長さが n、全員が `id`(文字列)・`username`・`displayName`(空でない文字列)・`avatar`(`null` または `data:image/svg+xml` で始まる文字列)を持つ、id が重複しない。fast-check で 0〜100 の任意の n について長さと id の一意性を確認する
  - `createMockMembers` は同じ引数で同じ結果を返す(決定的)
  - `buildMockChannels(null)`: 5チャネル、人数が 8/30/6/1/0、全チャネル名に `【モック】` を含む、全メンバーの id がチャネルをまたいでも重複しない、外部 URL(`http`)のアバターが無い
  - `buildMockChannels(12)`: 先頭(position 最小)が 12 人の `mock-custom`
- `mock-discord-client.test.js`(`delayMs: 0`)
  - `validateToken` が `{ valid: true, guildId: 'mock-guild' }`
  - `getChannels` の各要素が `{ id, name, position, memberCount }` で、`memberCount` がメンバー数と一致し、position 昇順
  - `getVoiceChannelMembers` が該当チャネルのメンバーを返す。返り値を書き換えても次の呼び出し結果が変わらない
  - 未知の id で `type: 'NOT_FOUND'`, `status: 404` を reject
  - `createMockDiscordClient(new URLSearchParams('mock=12'))` で 12 人チャネルが含まれ、`'mock'`(値なし)では含まれない
- `mock-badge.test.js`(jsdom)
  - 呼ぶと `#mock-badge` が1つでき、2回呼んでも1つのまま

ビルド検査(テスト時に手動で実行、`/loop-basic:test` の手順に含める):

- `npm run build` が成功する
- `dist/` の `*.js` と `*.html` に `【モック】`・`mock-badge` が含まれない(`*.map` はソースを含むので対象外。ミニファイでクラス名は潰れうるが、文字列リテラルの `【モック】` は残るので目印として十分)。例:
  - PowerShell: `Get-ChildItem dist -Recurse -Include *.js,*.html | Select-String '【モック】|mock-badge'` が 0 件
  - bash: `grep -rlE '【モック】|mock-badge' dist --include='*.js' --include='*.html'` が 0 件
- `dist/assets/` に `mock` を名前に含むファイルが無い

`app-controller.js` の分岐は import 時に `initialize()` が走り Jest の対象外(`jest.config.js` でも除外)のため、自動テストは書かず、上記ビルド検査と下記の手動確認で担保する。

手動確認(ブラウザ、`npm run dev`):

- `?mock` でバッジが出て、プリセット5チャネルがメンバー数付きで並ぶ
- 通常(8人)で4種類の演出が動き、結果表示・コピー・履歴保存ができる。除外・ロールも動く
- 大人数(30人)・長い名前のチャネルで表示が崩れないか確認(崩れは記録のみ。修正はスコープ外)
- 0人のチャネルで「メンバーがいません」エラーが出る
- `?mock=12` で 12 人のチャネルが先頭に出る。`?mock=abc` ではプリセットのみ
- `?mock` 無し・トークン無しで、案内文付きのエラーが出る
- `?mock&token=dummy` でもモックで動く(token は無視される)
- (Bot を起動できる場合)`?token=...` で従来どおり実 API で動く

完了の基準: `npm test` が全件成功、ビルド検査に合格、上記の手動確認で新たな不具合が無い(既存不具合の発見は記録して別トピックにする)。

## リスク・トレードオフ

- **本番への混入**: `js/dev/` を誤って静的 import すると本番に入る。設計で静的 import を禁止し、ビルド検査で確認する。`?mock` は本番では `import.meta.env.DEV` が `false` なので効かない
- **実 API との形のずれ**: 将来 `server/index.js` のレスポンスが変わるとモックが追随しない。モックの単体テストが形を固定しているので、変えるときはテストも直すことになる。ファイル先頭のコメントで対応関係を明記する
- **確認できない範囲**: 実 API・CORS・トークン期限切れの経路はモックでは確認できない。それらに関わる変更では、従来どおり実環境での確認が必要
- **`vite preview` では使えない**: `vite preview` は本番ビルドを配信するのでモックは無効。モックは `npm run dev` 専用

## ロールバック方針

追加は `js/dev/` の新規ファイル、テスト、`app-controller.js` の分岐だけ。問題があれば該当 PR を revert すれば元に戻る。本番の挙動は変えないため、本番側の切り戻しは発生しない想定。

## 壁打ちの記録

- 履歴: モックの結果もそのまま保存する(guildId `mock-guild` で区別でき、履歴機能自体も確認できる)
- 遅延: 既定 300ms(ローディング表示の確認用)
- トークン無しエラーの案内文: 開発時のみ出す
- `import.meta.env.DEV` 分岐内の動的 import が本番ビルドで消えること: Vite の仕様上そうなるはずだが、`[要検証]` としてテスト時のビルド検査で確認する

## 設計レビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 | PASS | MINOR のみ: token と mock 併用時の優先順、ビルド検査コマンドの具体化、DCE 失敗時のフォールバック、createMockMembers の引数、fast-check の import 形式、app-controller を自動テストしない理由。すべて反映済み。カバレッジ閾値の指摘は `npm test` が `--coverage` を付けないため対象外 |

未解決のMAJORが残った場合: なし

## コードレビュー結果

| ラウンド | 判定 | 主な指摘 |
| --- | --- | --- |
| 1 |  |  |

未解決のMAJORが残った場合:

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 承認 | 設計レビュー PASS(MAJOR なし)。修正なしで承認 |
