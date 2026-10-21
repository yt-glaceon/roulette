# 調査: Node.js 24 への移行(node24-upgrade)

- 日付: 2026-10-21
- ステータス: 完了(`npm test` / `npm run build` / `npm audit` はメインエージェントが実行して追記済み)
- 関連する設計ドキュメント: [docs/designs/2026-10-21-node24-upgrade.md](../designs/2026-10-21-node24-upgrade.md)

## 背景・目的

2026-10-21 に Node.js のセキュリティリリースが公開された。修正版は v22.23.4 / v24.22.1 / v26.12.1。HIGH は 4 件(CVE-2026-111497 Brotli デコーダの範囲外書き込み(RCE の可能性)、CVE-2026-105483 / CVE-2026-106069 の TLS ホスト名検証のすり抜け、CVE-2026-105482 の dns.resolve の NUL 切り詰め)。EOL 系列(Node 20 を含む)は修正されない。

- フロントエンドの `.github/workflows/deploy.yml` は `node-version: '20'`(EOL)。ビルド時のみ Node を使う。
- `server/`(Express 4 + discord.js 14)は Render 上で動くが、`server/package.json` に engines がなく、Render 側の Node バージョンが不明。
- 目的は「server/package.json に `engines.node = 24.x` を追加し、deploy.yml を `'24'` にする」ことの妥当性と、周辺の影響の洗い出し。

出典: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases(Node 20 は対象外と明記、CVE の対象系列は 22.x / 24.x / 26.x)。

## 現状の把握

### リポジトリ内の Node 指定

| 場所 | 現状 |
| --- | --- |
| `.github/workflows/deploy.yml` | `actions/setup-node@v4`、`node-version: '20'`、`cache: 'npm'` |
| `package.json`(ルート) | engines なし。`"type": "module"`。`test` は `node --experimental-vm-modules node_modules/jest/bin/jest.js` |
| `server/package.json` | engines なし。`start: node index.js` |
| `.nvmrc` / `.node-version` / `render.yaml` | リポジトリ内に存在しない(Glob で確認) |
| `README.md:61` | 「Node.js(v18 以上)」 |
| `SETUP.md:16` | 「Node.js v20 以上」 |
| `README.md:112-126`, `server/README.md:162-176` | Render の手順。「Environment: Node」のみで Node バージョンの指定手順はなし |
| `docs/process/project-dev.md:13,33` | バージョン記述なし(構成の説明のみ) |
| `.kiro/specs/bugfix-animation-and-env/design.md:286-289` | 過去の設計メモ内の `node-version: '20'`(履歴資料。更新不要) |
| `.kiro/specs/discord-voice-roulette/FINAL_STATUS.md` | バージョン記述なし |

### 依存の engines 欄(package-lock.json の grep 結果)

- ルート: jest 系は `^14.15.0 || ^16.10.0 || >=18.0.0`、vite 5 は `^18.0.0 || >=20.0.0`。その他に上限付きの指定はなく、Node 24 を除外するものは見当たらない。
- server: 最も厳しいものでも `>=18.17`(undici 6.21.3 系)。discord.js 系は `>=16.11.0` / `>=18`。上限付きの指定はない。
- server の主な解決バージョン: express 4.22.1、body-parser 1.20.4、qs 6.14.2、undici 6.21.3、ws 8.19.0。

つまり engines 欄の上では Node 24 を拒否する依存はない(静的確認)。

## 調査結果(調べてほしいこと 1〜5)

### 1. Render が Node バージョンを決める仕組み(https://render.com/docs/node-version)

- 優先順位(高い順): 環境変数 `NODE_VERSION` > リポジトリ root の `.node-version` > `.nvmrc` > `package.json` の `engines`。
- 指定形式は完全なバージョン、エイリアス(`lts` 等)、semver 範囲。Render は `node-version-alias` で解決する。
- 公式は「範囲指定には上限を付けよ」と推奨(`>=20` は最新リリースに解決され、時間とともに変わる)。
- `24.x` の例は公式ページにない。ただし semver 範囲に対応しており、標準的な解決なら 24 系の最新パッチになるはず。ただし「Render がビルド時に最新パッチを取得するか、事前に用意した版だけから選ぶか」は公式に記載がなく不明(= 修正版 24.22.1 が実際に選ばれる保証は文書上は確認できない)。
- `package.json` は「repo の root に無ければ、サブディレクトリで最初に見つかったものを使う」。**Root Directory 設定との関係は公式ページに記載がない**。本リポジトリはルートにも `package.json` があるため、Root Directory が `server` でも「ルートの package.json が読まれる」可能性を排除できない。
- `.node-version` / `.nvmrc` は「repo の root」に置くと書かれている。Root Directory が `server` の場合に root が repo root か `server/` かも記載なし。
- 既定バージョンはサービス作成日で決まる。2026-09-17 以降は 24.21.0、2026-04-21〜09-17 は 24.14.1、2026-01-14〜04-21 は 22.22.0、2025-06-12〜2026-01-14 は 22.16.0、2024-07〜10 は 20.15.1。いずれも今回の修正版(24.22.1 / 22.23.4)より古い。このサービスの作成日が分かれば現在の版が推定できるが、作成日は未確認。
- 影響: engines を書かない場合は作成日時点の固定の既定版のまま(古い 22.x や 20.x の可能性)。Node 20 だった場合は EOL で修正されない。

### 2. actions/setup-node で `node-version: '24'`

- 公式 README(https://github.com/actions/setup-node)では `node-version: 24` のようなメジャーのみ指定が有効な構文。
- 動作は「まずローカルの tool cache で semver 一致を探し、無ければダウンロード」。ホストランナーにプリインストールされた版が一致すると、その版が使われ得る(最新パッチとは限らない)。
- `check-latest: true` を付けると、一致する範囲で最新を確認しにいく。既定は false。公式 README は「LTS 系の指定に効く」旨の記述で、`24` で必ず最新になるかは文面だけでは断定できない。ビルド時のみ Node を使う用途で、HIGH の脆弱性への実際の暴露は小さいが、確実に修正版を使いたいなら `check-latest: true` の付与が安全側。
- `cache: 'npm'` は npm のダウンロードキャッシュ(~/.npm)を `package-lock.json` のハッシュで保存する。Node のバージョンを変えるとキャッシュキーにもバージョンが入るため、初回はキャッシュミスになるだけで問題はない。
- `actions/setup-node` の最新は v7(README 記載)。v5 でアクション自体のランタイムが node20 から node24 になった。v4 のままでも `node-version: '24'` は動く。v7 はレジストリ周りの `NODE_AUTH_TOKEN` のダミー値が廃止されるが、本ワークフローは `registry-url` を使っていないので影響しない見込み。ただしアクション自体の更新は今回のトピックの範囲外(別トピック候補)。

### 3. Node 24 での動作

- 静的確認(上記 engines 欄)では問題なし。
- 実機確認(メインエージェントがワークツリーで実行、Node v24.13.1): `npm test` は 12 スイート / 145 テストすべて PASS。`npm run build` も成功(`dist/` 生成)。フロントのビルド・テストは Node 24 で問題なし。
- 注意点(既存の落とし穴): Jest は ESM 実行(`--experimental-vm-modules`)。Node 24 でもこのフラグは有効だが、実行時に ExperimentalWarning が出る。`docs/memory/entries/jest-esm-globals.md` も参照。
- server の実起動(Discord への接続を伴う)は Bot トークンが必要で、本調査では対象外。

### 4. ドキュメントの Node バージョン記述

| ファイル | 現記述 | 判断材料 |
| --- | --- | --- |
| `README.md:61` | v18 以上 | v18 は EOL。サポート下限を 24 に揃えるなら更新対象。engines と矛盾させないために更新を推奨 |
| `SETUP.md:16` | v20 以上 | v20 も EOL。同上 |
| `server/README.md` | バージョン記述なし(Render 手順のみ) | engines を追加するなら、Render が engines を読む旨を 1 行足すと親切 |
| `README.md:112-126` / `server/README.md:162-176` | Render 手順 | 現状バージョン指定の説明がない。`NODE_VERSION` を使うか engines に任せるかを書く場所の候補 |
| `.kiro/specs/...` | 過去メモ | 履歴のため更新しない |

下限の文言は「24 以上」にするか、「24.x 推奨」にするかを設計で決める。

### 5. 代替案(ルート engines / .nvmrc など)

選択肢の比較を参照。

## 選択肢の比較

### A. バージョン固定の置き場所(Render 側)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案A: `server/package.json` の engines `"node": "24.x"`(依頼どおり) | コードと一緒にレビュー・履歴管理できる。範囲指定で 24 系の新しいパッチを取れる見込み | 優先順位が最も低く、Render に `NODE_VERSION` が設定済みなら無視される。Root Directory との関係が公式に未記載。`24.x` が最新パッチに解決される保証が文書上はない | 公式の上限付き推奨に合致(`24.x` は上限あり) |
| 案B: Render ダッシュボードの `NODE_VERSION` 環境変数 | 最優先で確実。Render のドキュメント上、挙動が明確 | リポジトリ外の設定でレビューに残らない。手作業 | 案A と併用すると engines 側が形骸化するリスク |
| 案C: リポジトリ root に `.node-version`(`24` など)を置く | 優先順位が engines より高い。ローカルの nvm / fnm / Volta 系や actions/setup-node の `node-version-file` からも共有できる | Render が Root Directory `server` のとき root を見るのか `server/` を見るのか公式に記載なし | CI と Render のバージョンを 1 ファイルに集約できる |
| 案D: 案A + 案C(+ ルート engines)の併用 | 多重化で取りこぼしにくい | 管理箇所が増え、食い違うと混乱する | 食い違いは Render の優先順位表で一意には決まる |

### B. CI のバージョン指定(deploy.yml)

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案E: `node-version: '24'` のみ | 変更が最小。依頼どおり | 最新パッチとは限らない(キャッシュ済みの版が使われ得る) | ビルド時のみの利用で実害は小さい |
| 案F: `'24'` + `check-latest: true` | 修正版(24.22.1 以降)を確実に取りやすい | セットアップが数秒遅くなる場合がある | 追加 1 行 |
| 案G: `node-version-file: '.nvmrc'`(または `.node-version`)へ移行 | バージョンの単一情報源になり、Render 案Cとも揃う | ファイルの追加が必要で依頼の範囲を少し超える | 設計で判断 |

### C. ルート package.json の engines

| 選択肢 | メリット | デメリット | 備考 |
| --- | --- | --- | --- |
| 案H: ルートにも `engines` を付ける | ローカル開発・CI で Node 24 を明示でき、`npm ci` が `engine-strict` 時に警告・拒否できる | 付与する範囲(`24.x` か `>=24`)を決める必要。Render が「ルートの package.json」を読む挙動と結びつく可能性があり(後述)、server 側の engines と食い違わないようにする必要 | 既存の jest / vite の engines とは矛盾しない |
| 案I: ルートには付けない | 変更が最小 | ローカルや他の貢献者が古い Node で動かしても気付けない | フロントはビルド時のみ Node を使うので実害は小さい |

## 推奨アプローチ

1. **依頼どおり `server/package.json` に `"engines": { "node": "24.x" }` を追加し、deploy.yml を `'24'` にする(案A + 案E)を土台にする**。さらに次の 2 点を設計で検討することを推奨する。
   - deploy.yml に `check-latest: true` を足す(案F)。1 行で、修正版を取りやすくなる。
   - **Render の実際の挙動確認を実装後の必須手順にする**。Render のダッシュボードで `NODE_VERSION` が設定されていないこと、デプロイログの Node バージョン表示が 24.22.1 以降になっていることを確認する。公式ドキュメントだけでは「Root Directory が `server` のときに `server/package.json` の engines が読まれるか」「`24.x` が最新パッチになるか」を保証できないため。
2. 確認の結果、engines が効かない場合の退避策は案B(`NODE_VERSION=24` を Render に設定)が最も確実。案C(`.node-version`)は Root Directory との関係が不明なので、ダッシュボードで確認できてからにする。
3. ルート engines(案H)は、Render がルートの `package.json` を読む可能性があるため、付ける場合は server と同じ `24.x` に揃える。付けない選択(案I)も妥当。設計で決める。
4. README.md / SETUP.md の「v18 以上」「v20 以上」は、サポート下限が EOL のままだと実態と食い違うので同時に更新することを推奨(例: 「Node.js v24」)。

理由: 変更が小さく、レビューに残り、公式の「上限付き範囲」推奨にも沿う。一方で Render の読み取り仕様に未確認点が残るため、デプロイ後の検証と退避策をセットにするのが安全。

## 制約・リスク

- Render で `NODE_VERSION` が既に設定されている場合、engines は無視される(優先順位が最低)。
- 脆弱性の実暴露: CVE-2026-111497(Brotli)は、`body-parser` 1.20.4 が gzip / deflate のみ展開するため直接の経路は見当たらない、という判断済みの前提。ただし discord.js 経由の undici(6.21.3)などが Brotli を展開する可能性は未確認(Discord への送信先は固定の信頼先なので低リスクと見られるが、調査は未実施)。TLS ホスト名検証の件は、discord.js が Discord へ TLS 接続するため、ランタイムの更新自体に意味がある。
- Node 24 での実機動作(テスト・ビルド・server 起動)は未確認(上記)。
- GitHub Actions 側の他アクション(`actions/checkout@v4`、`setup-node@v4`、`configure-pages@v4`、`upload-pages-artifact@v3`、`deploy-pages@v4`)は node20 ランタイムの古い版を使っている。今回のトピックの範囲外だが、GitHub 側の node20 廃止方針で警告・動作変更が起き得る(別トピック候補。要確認)。
- Render 側は無料プランで再デプロイ時に Node が切り替わるため、デプロイ直後にコールドスタートや Bot 再接続の確認が要る。

## 範囲外の関連事項(npm audit 9 件: critical 1, high 4)

メインエージェントが `server/` で `npm audit` を実行した結果(2026-10-21)。すべて「fix available via `npm audit fix`」(package.json の範囲内で lockfile 更新のみで直る)。

| パッケージ | 重大度 | 主な内容 | このアプリでの暴露 |
| --- | --- | --- | --- |
| proxy-addr 1.1.0–2.0.7 | critical | IPv4-mapped IPv6 の trust subnet で IP 偽装 | `server/index.js` は `trust proxy` を設定していないため、実質の経路は小さい |
| undici <=6.28.0(discord.js 経由) | high | Set-Cookie ヘッダ注入、keep-alive でのレスポンスキュー汚染、WebSocket DoS ほか 9 件 | 通信先は Discord に固定。低〜中 |
| path-to-regexp <0.1.13(express 経由) | high | 複数ルートパラメータでの ReDoS | ルート定義次第。外部から叩ける API なので要対応 |
| lodash <=4.17.23 | high | `_.template` のコード注入、プロトタイプ汚染 | 直接は未使用(依存経由) |
| body-parser <1.20.6 | moderate | limit 値不正時にサイズ制限が無効化 | 既定の limit を使っており低 |
| qs 2.2.5–6.15.3 | moderate | 配列上限のすり抜け、DoS | Express のクエリ解析で使われるため要対応 |

- 判断: どれも `npm audit fix`(lockfile のみの更新)で直るため、今回のトピックに含めるかどうかを設計で決める(依頼の範囲を少し超える)。
- ルート側(フロント)の `npm audit` は未確認(フロントはビルド時のみ Node を使い、本番は静的配信なので優先度は低い)。

## 未解決の疑問・要確認事項

1. (解決・2026-10-21 ダッシュボードで確認)現在の Node は `22.22.0 (default)`(修正前)。`NODE_VERSION` は未設定。Root Directory は `server`、Build Command は `npm install`。最初のデプロイは約 8 か月前。
2. (解決・2026-10-22 実測)Root Directory が `server` のとき、Render は `server/package.json` の engines を読んだ(ログ: `Using Node.js version 24.22.1 via /opt/render/project/src/server/package.json`)。以下は当初の疑問: Root Directory が `server` のとき、Render が読む `package.json` / `.node-version` / `.nvmrc` の位置(公式に記載なし)。Render のサポートに問い合わせるか、実際にデプロイして検証する必要がある。
3. (解決・2026-10-22 実測)`24.x` は Render で 24.22.1(修正版、リリース当日)に解決された。以下は当初の疑問: engines の `24.x` が Render で最新パッチ(24.22.1 以降)に解決されるか(解決は `node-version-alias` だが、利用可能な版の取得元は文書化されていない)。
4. (解決)ローカル Node v24.13.1 で `npm test` / `npm run build` とも成功。ローカルの Node 自体は修正版 24.22.1 より古い(ローカル更新は利用者側で別途)。
5. (内訳判明)server の `npm audit` 9 件は「範囲外の関連事項」の表のとおり。今回含めるかは設計で決める。
6. discord.js / undici 経由の Brotli 展開経路の有無。
7. ルートの engines を付けるか、`.nvmrc` / `.node-version` を置くか、README / SETUP の記述を更新するかの方針。
8. `actions/setup-node` を v4 のままにするか(別トピック)。

## 参考資料

- Node.js セキュリティリリース: https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- Render Node.js バージョン: https://render.com/docs/node-version
- actions/setup-node: https://github.com/actions/setup-node

---
次のアクション: `/loop-basic:design` で設計フェーズに進む
