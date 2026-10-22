# 調査: README を現状の実装に合わせて更新する(readme-refresh)

- 日付: 2026-10-22
- ステータス: 完了
- 関連する設計ドキュメント: [2026-10-22-readme-refresh.md](../designs/2026-10-22-readme-refresh.md)

## 背景・目的

ここ数件のトピックで次の変更が入ったが、ルートの `README.md` には反映されていない。README の記述と実装・運用が食い違っている箇所を洗い出し、直す範囲を決める。

- ci-actions(PR #6): ESLint の導入、`ci.yml` の `verify`、`deploy.yml` のデプロイ前検証、main のブランチ保護(PR 必須・`verify` 必須)
- token-log-masking(PR #7): API へのアクセストークンを URL のクエリではなく `x-access-token` ヘッダで送るように変更、`server/log-safe.js` の追加
- それ以前: 演出の `js/animations/` への分割、モック(`js/dev/`)、`tests/unit/` の追加

## 現状の把握

### 1. API エンドポイントのトークン受け渡し

- README「API エンドポイント」節: 4 つとも `GET /api/...?token=xxx` と書かれている。
- 実装: `server/index.js:148-149` の `validateToken` は `req.headers['x-access-token']` だけを見る。クエリの `token` は読まない。フロントは `js/api-request.js` が `x-access-token` ヘッダを付けて送る。
- トークンが無い・無効・期限切れのときは 401 と日本語のエラーメッセージを返す(`server/index.js:151-162`)。
- Bot が返す URL は今も `${FRONTEND_URL}?token=${token}`(`server/index.js:91`)。フロントがこのクエリからトークンを読み、API にはヘッダで送る。README「使い方」節の `?token=abc123...` の例は正しい。
- トークンの有効期限 1 時間(`server/index.js:80`)も README の記述どおり。

### 2. プロジェクト構造

README の構造図と実ファイルの差分:

| README の記述 | 実際 |
| --- | --- |
| `js/roulette-wheel.js` | `js/animations/roulette-wheel.js` |
| (記載なし) | `js/api-request.js`(API リクエストの組み立て) |
| (記載なし) | `js/animations/`(`animation-timing.js`・`card-flip.js`・`drum-roll.js`・`roulette-wheel.js`・`slot-machine.js`) |
| (記載なし) | `js/dev/`(`mock-badge.js`・`mock-data.js`・`mock-discord-client.js`。開発サーバー専用のモック) |
| (記載なし) | `server/log-safe.js`(ログ用の伏せ字・エラー要約) |
| (記載なし) | `tests/unit/`(Jest のユニットテスト 14 ファイル) |
| (記載なし) | `.github/workflows/ci.yml`・`deploy.yml`、`.github/actions/verify/` |
| (記載なし) | `eslint.config.js`・`jest.config.js`・`vite.config.js`・`SETUP.md`・`docs/` |

`css/style.css`・`index.html`・`js/` のその他のファイル・`server/index.js` 等は README どおり。

### 3. 開発・CI・デプロイの説明

- README には `npm test`・`npm run lint`・`npm run build` の説明がない(`package.json` には `test`・`test:watch`・`test:coverage`・`lint`・`build`・`preview` がある)。
- README「4. フロントエンドのセットアップ」は「`http://localhost:5500` にアクセス」と書くが、`vite.config.js` の `base: '/roulette/'` により実際のパスは `http://localhost:5500/roulette/`。Discord なしで確認できるモック(`?mock`・`?mock=12`)も README にない(`docs/process/project-dev.md` にはある)。
- README「6.3 デプロイ」は `git push origin main` で自動デプロイと説明している。実際は:
  - main はブランチ保護で PR 必須・必須チェック `verify` が通るまでマージできない。直接 push は通らない。
  - `ci.yml` の `verify` が main 向け PR と main への push で走る(lint → `node --check server/index.js` → テスト → ビルド → モック混入チェック。中身は `.github/actions/verify`)。
  - `deploy.yml` は main への push で `pre-deploy-verify`(同じ action)が通ったときだけ GitHub Pages へデプロイする。
  - バックエンドは `server/` を変更したコミットだけ Render に自動デプロイされる(共有メモリ [render-root-dir-autodeploy](../memory/entries/render-root-dir-autodeploy.md))。

### 範囲外で見つかった同種のずれ

- `server/README.md:86-129` の API 説明も `?token=xxx` のまま。
- `SETUP.md:105-110` も `git push origin main` で自動デプロイと説明している。

依頼は「README を 3 点」なので、これらを含めるかは設計フェーズで人間に確認する。

## 選択肢の比較

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A: README の該当節だけを最小限書き換える(API 節・構造図・セットアップ/デプロイ節の修正と「開発」節の追加) | 差分が小さくレビューしやすい。既存の構成・文体を保てる | SETUP.md・server/README.md との食い違いは残る | 依頼どおりの範囲 |
| 案B: README を全面的に書き直す | 構成から整理できる | 依頼の範囲を超える。差分が大きくなり確認の負担が増える | |
| 案C: 案A に加えて server/README.md と SETUP.md の同じずれも直す | 文書間の食い違いがなくなる | 依頼の範囲(README のみ)を広げる | 人間の判断が必要 |

## 推奨アプローチ

案A を基本にする。README の既存の節立て・文体(です・ます調、絵文字付きの特徴一覧)は保ち、食い違っている 3 点だけを直す。server/README.md・SETUP.md まで広げるか(案C)は設計の壁打ちで人間に確認する。

## 制約・リスク

- 変更はドキュメントのみでコードに影響しない。`verify`(lint・テスト・ビルド)はそのまま通るはず。
- `deployNote` のとおり main へのマージで GitHub Pages のデプロイが走るが、README はビルド成果物に入らないため本番の見た目は変わらない。`server/` を触らなければ Render もデプロイされない(案C で `server/README.md` を変えると Render の再デプロイが走る)。
- README に `.env` の中身や本番の URL・トークンを書かない。

## 未解決の疑問・要確認事項

- server/README.md と SETUP.md の同じずれも今回直すか(案C)。
- API 節にエラー時の応答(401)まで書くか。

## 参考資料

- `server/index.js`・`js/api-request.js`・`vite.config.js`・`package.json`
- `.github/workflows/ci.yml`・`.github/workflows/deploy.yml`
- `docs/process/project-dev.md`
- [docs/designs/2026-10-22-token-log-masking.md](../designs/2026-10-22-token-log-masking.md)・[docs/designs/2026-10-22-ci-actions.md](../designs/2026-10-22-ci-actions.md)

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
