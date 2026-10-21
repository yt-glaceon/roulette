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

- [ ] Render のサービスを Suspend する(本番 Bot との二重起動回避。できない場合は二重起動を許容しローカル API の直接確認に限る)
- [ ] ワークツリーの `server/` で Node 24 を使い `npm start`
- [ ] ログに「Bot logged in as ...」「スラッシュコマンドの登録完了」「Server running on port ...」が出る
- [ ] `curl http://localhost:<ログのポート>/` が `status: ok` を返す
- [ ] Discord で `/roulette` を実行し、ローカルのログに `[Roulette] トークン生成:` が出る
- [ ] そのトークンで `/api/validate-token?token=...`、`/api/guild`、`/api/guild/channels`、`/api/guild/channels/<channelId>/members` が正しく応答する(トークン値は記録に書かない)
- [ ] 確認後、Render を Resume する

(b) デプロイ後の確認(設計書「デプロイ後の確認」1〜6)

- [ ] 1. GitHub Actions の `Setup Node.js` で使われた Node が 24.22.1 以降(未満なら追跡事項として残す)
- [ ] 2. Render のデプロイが今回のマージコミットであること(自動デプロイが走らなければ Manual Deploy。古いログで判断しない)
- [ ] 3. デプロイログの `==> Using Node.js version ...` を全文記録し、24 系でなければ `NODE_VERSION=24`、24.22.1 未満なら `NODE_VERSION=24.22.1` を試す
- [ ] 4. Render の Environment の `NODE_VERSION` の有無を確認
- [ ] 5. デプロイ後に Bot が再接続しログインし、`GET /` が `status: ok` を返す(コールドスタートを考慮)
- [ ] 6. 実測結果を調査ドキュメントの未解決事項 2・3 と `render-node-version` エントリに追記

## コードレビューからの引き継ぎ

未解決の MAJOR なし。MINOR 1 件(未実施): express@4.22.3 への lockfile 更新(`npm update express --package-lock-only`)で残る qs の moderate 指摘が消せる見込み。実行するかはユーザー判断。

## 総合判定

エージェントで確認できる範囲: 合格(設定内容、ルートの `npm ci` / `npm test` 145 件 / `npm run build`、server のトークン無し起動、いずれも Node v24.13.1 で問題なし。server の audit は critical / high 0 件、moderate 1 件 qs が残存)。

ただし、実 `.env` でのローカル起動確認とデプロイ後確認は「人間の確認待ち」であり、完全な合格判定はそれらの完了後。

## 人間確認ゲート記録

| 日時 | 判断 | コメント |
| --- | --- | --- |
| 2026-10-21 | 修正依頼 | テスト結果は承認。ただし express 4.22.3 への lockfile 更新(残る qs 指摘の解消)を今回に含めることになったため、実装に戻る(ステップ9) |
