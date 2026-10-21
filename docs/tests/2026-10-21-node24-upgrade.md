# テストレポート: Node.js 24 への移行(node24-upgrade)

- 日付: 2026-10-21
- ステータス: レビュー待ち
- 対応する設計ドキュメント: docs/designs/2026-10-21-node24-upgrade.md

## テスト対象

server(Render)とルート(CI/フロント)の Node を 24 系に揃える設定変更とドキュメント更新(実装ステップ1〜5)、および server の `npm audit fix`(lockfile のみ)。アプリのコードは変更なし。本レポートは実装ステップ6〜8のうち、エージェントが実行できる範囲(ステップ6、ステップ7のトークン無し起動)の結果。実 `.env` での起動確認とデプロイ後確認は人間の作業(後述)。

実行環境: Node v24.13.1(手元。修正版 24.22.1 ではない)、ワークツリー `.claude/worktrees/node24-upgrade`。`.claude/loop.config.json` の `verify` は test=`npm test`、build=`npm run build` を実行。lint / typecheck / e2e は null のためスキップ。

## 実施したテスト

| 種別 | 内容 | 結果 |
| --- | --- | --- |
| 内容確認 | `server/package.json` の engines は `{"node":"24.x"}`、ルート `package.json` も `{"node":"24.x"}` | pass |
| 内容確認 | `deploy.yml` を YAML としてパースし、setup-node の `with` が `{"node-version":"24","check-latest":true,"cache":"npm"}` | pass |
| 自動テスト | ルートで `npm ci`(node -v = v24.13.1)。EBADENGINE などの engines 警告・失敗なし。deprecated 警告のみ | pass |
| 自動テスト | ルート `npm test`(node -v = v24.13.1): 12 スイート / 145 テスト全て PASS。ExperimentalWarning(VM Modules)と punycode の DeprecationWarning は既知で失敗ではない | pass |
| ビルド | ルート `npm run build`(node -v = v24.13.1): vite 5.4.21 で成功、`dist/`(index.html、assets)が生成 | pass |
| 型チェック/Lint | 未構成(verify が null)のためスキップ | 対象外 |
| 手動確認(ゴールデンパス) | server のトークン無し起動(Node 24 で express / discord.js を読み込めるか)。下記証跡 | pass |
| 手動確認(エッジケース) | `npm audit`(server)の残存指摘の確認。下記 | 記録(critical / high は 0 件) |

## 証跡(手動確認分)

### server のトークン無し起動

- cwd は `.env` の無いスクラッチディレクトリ `...\scratchpad\node24-start`(`ls -a` の出力は `.` と `..` のみで `.env` なしを確認)。`server/` は cwd にしていない。実トークンは使っていない。
- コマンド: `DISCORD_BOT_TOKEN= timeout 30 node <ワークツリー>/server/index.js`(Git Bash)
- 出力(ログ全文は `...\scratchpad\node24-start.log` にも保存):

```
🚀 Server running on port 3000
...\server\node_modules\discord.js\src\client\Client.js:217
    if (!token || typeof token !== 'string') throw new DiscordjsError(ErrorCodes.TokenInvalid);
DiscordjsError [TokenInvalid]: An invalid token was provided.
    at Client.login (...\discord.js\src\client\Client.js:217:52)
    at file:///.../server/index.js:25:8
    ...
  code: 'TokenInvalid'
Node.js v24.13.1
```

- 判定: TokenInvalid でプロセスが終了。`ERR_MODULE_NOT_FOUND` などのモジュール解決エラーなし。Node 24 で express / discord.js の import と起動直前までの処理が通ることを確認(期待どおり。この終了は既存挙動で失敗ではない)。

### server の `npm audit`(ステップ5後)

- 残り 1 件(moderate): `qs` 2.2.5 - 6.15.3(GHSA-q8mj-m7cp-5q26、GHSA-x5fp-wj9c-mxmx、GHSA-4mjr-xmp4-gh2g)。critical / high は 0 件。
- 残る理由: express@4.22.1 が qs 6.14.2 を固定しているため(共有メモリ `express-qs-pinned-audit`)。express 4.22.3(qs ~6.16.0)が `^4.18.2` の範囲にあるため、`npm update express --package-lock-only` で解消できる見込みだが未実施。
- 補足: `npm audit` は表示上「`npm audit fix` で直る」と出すが、既に audit fix 済みの状態で残っている指摘であり、上記の express 更新が必要。

### ルート `npm ci` の audit 表示(参考)

ルートは 45 件(low 2、moderate 4、high 39)。設計書のスコープ外(ルート側の `npm audit` 対応は対象外。ビルド時のみ Node を使い本番は静的配信)。

## 不合格・不具合の詳細

なし。

## 未検証の観点・既知の制限事項

- 手元の Node は 24.13.1 で、修正版 24.22.1 ではない。テスト結果は「Node 24 系で既存機能が動く」ことの確認であり、修正版が適用されることの確認ではない。
- lint / typecheck / e2e は verify が null のためスキップ。server にはテスト基盤がなく、自動テストは新規作成しない設計判断(設計書のとおり)。
- ステップ1・2・5の lockfile 差分の内容(engines 追記のみ、依存更新はステップ5のみ)は今回の再確認の対象外(実装・コードレビューで確認済み)。
- ルート依存の deprecated 警告と audit 指摘 45 件は既存でスコープ外。

### 人間の確認待ち

(a) 実 `.env` でのローカル起動確認(マージ前、人間が実施)

- [x] 前提: ワークツリーの `server/node_modules` が `npm ci --prefix server` 済みで express が 4.22.3 であること(再テストで実施済み。別環境で行う場合は再度 `npm ci`)
- [x] Render のサービスを Suspend する(本番 Bot との二重起動回避。できない場合は二重起動を許容しローカル API の直接確認に限る)
- [x] ワークツリーの `server/` で Node 24 を使い `npm start`
- [x] ログに「Bot logged in as ...」「スラッシュコマンドの登録完了」「Server running on port ...」が出る
- [x] `curl http://localhost:<ログのポート>/` が `status: ok` を返す
- [x] Discord で `/roulette` を実行し、ローカルのログに `[Roulette] トークン生成:` が出る
- [x] そのトークンで `/api/validate-token?token=...`、`/api/guild`、`/api/guild/channels`、`/api/guild/channels/<channelId>/members` が正しく応答する(トークン値は記録に書かない)
- [x] 確認後、Render を Resume する

2026-10-21 ユーザーがローカル起動確認を実施し、問題なし(Bot ログイン、スラッシュコマンド登録、API 応答 OK。Render は確認後 Resume 済み)。

(b) デプロイ後の確認(設計書「デプロイ後の確認」1〜6)

- [x] 1. GitHub Actions の `Setup Node.js` で使われた Node が 24.22.1 以降(未満なら追跡事項として残す)
- [x] 2. Render のデプロイが今回のマージコミットであること(自動デプロイが走らなければ Manual Deploy。古いログで判断しない)
- [x] 3. デプロイログの `==> Using Node.js version ...` を全文記録し、24 系でなければ `NODE_VERSION=24`、24.22.1 未満なら `NODE_VERSION=24.22.1` を試す
- [x] 4. Render の Environment の `NODE_VERSION` の有無を確認
- [x] 5. デプロイ後に Bot が再接続しログインし、`GET /` が `status: ok` を返す(コールドスタートを考慮)
- [x] 6. 実測結果を調査ドキュメントの未解決事項 2・3 と `render-node-version` エントリに追記

デプロイ後の確認結果(2026-10-21〜22、マージコミット 43cb53b):

1. GitHub Actions(run 39625601391、成功): `Setup Node.js` は `Attempting to download 24.22.0...` / `node: v24.22.0`。`check-latest: true` でも 24.22.1 ではなかった(setup-node の配布元に修正版がまだ無いとみられる)。**追跡事項**: 次回以降の実行で 24.22.1 以降になることを確認する。ビルド時のみの利用で本番は静的配信のため実害は小さい。なお GitHub の障害(Delays for Pull Requests and Webhook deliveries)で、実行はマージから約 20 分遅れた。
2. Render の自動デプロイは走らなかった(GitHub の Webhook 遅延障害と重なったとみられる)。ユーザーが Manual Deploy し、デプロイ対象が 43cb53b であることを確認。
3. デプロイログ: `==> Requesting Node.js version 24.x` / `==> Using Node.js version 24.22.1 via /opt/render/project/src/server/package.json`。engines が読まれ、修正版 24.22.1 になった。`npm install` の audit は `found 0 vulnerabilities`。
4. `NODE_VERSION` は未設定のまま(設定不要だった)。
5. 「Bot logged in as ...」「スラッシュコマンドの登録完了」「Your service is live」。`GET https://roulette-api-nsza.onrender.com/` が `{"status":"ok", ...}` を返した。
6. 調査ドキュメントの未解決事項 2・3 と共有メモリ `render-node-version` に反映済み。

## 再テスト(ステップ9 後)

対象: コミット 508c688(express を 4.22.3 に更新、server/package-lock.json のみ)。HEAD は a3eafb6。実行 Node は v24.13.1。

| 内容 | 結果 |
| --- | --- |
| `npm ci --prefix server`: 96 パッケージ追加、EBADENGINE などの警告なし、0 vulnerabilities | pass |
| `server/node_modules/express/package.json` の version が 4.22.3(qs は 6.16.1) | pass |
| server の `npm audit`: found 0 vulnerabilities(前回残っていた qs の moderate が解消) | pass |
| トークン無し起動(前回と同じ手順、npm ci 後に実施): TokenInvalid で終了、ERR_MODULE_NOT_FOUND は 0 件 | pass |
| ルート `npm test`(参考の再実行): 12 スイート / 145 テスト PASS | pass |
| 作業ツリーに未コミットの変更なし | pass |

トークン無し起動の証跡(cwd は `.env` の無いスクラッチディレクトリ、`ls -a` で `.` と `..` のみ、`DISCORD_BOT_TOKEN= timeout 30 node <ワークツリー>/server/index.js`)。スタックトレースは省略。ログ全文は `...\scratchpad\node24-start-step9.log`:

```
🚀 Server running on port 3000
...\server\node_modules\discord.js\src\client\Client.js:217
    if (!token || typeof token !== 'string') throw new DiscordjsError(ErrorCodes.TokenInvalid);
DiscordjsError [TokenInvalid]: An invalid token was provided.
  code: 'TokenInvalid'
Node.js v24.13.1
```

注記: 作業順の都合で、npm ci の前(更新前の node_modules)にも同じ起動を 1 回実行し、同じ結果だった。上記の証跡と判定は npm ci 後の再実行のもの。

express 4.22.3 / qs 6.16.1 での実 API 応答(path-to-regexp、qs のクエリ解析、body-parser)は、2026-10-21 にユーザーのローカル起動確認で問題なしを確認。

## コードレビューからの引き継ぎ

未解決の MAJOR なし。MINOR 1 件(express@4.22.3 への lockfile 更新)は、ゲート2の修正依頼でステップ9として実施済み(コミット 508c688)。結果は上記「再テスト(ステップ9 後)」を参照。

## 総合判定

**最終: 合格**(ローカル起動確認、デプロイ後確認とも完了。追跡事項は GitHub Actions の Node が 24.22.0 だった点のみ)。

エージェントで確認できる範囲: 合格(初回テストおよびステップ9後の再テストとも、Node v24.13.1 で問題なし)。ステップ9後は server の `npm audit` が 0 件(critical / high / moderate いずれも無し)になった。

実 `.env` でのローカル起動確認は 2026-10-21 にユーザーが実施して問題なし。デプロイ後確認は残る。

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 修正依頼 | テスト結果は承認。ただし express 4.22.3 への lockfile 更新(残る qs 指摘の解消)を今回に含めることになったため、実装に戻る(ステップ9) |
| 2026-10-21 | 承認してクローズ | ステップ9(express 4.22.3)後の再テストとコードレビュー PASS を確認して承認。マージ前に人間が実 .env でローカル起動確認を行う |
