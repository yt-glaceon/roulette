# 設計書：アニメーション修正と環境変数管理

## 概要

本設計書は、Discord ボイスルーレットアプリケーションのバグ修正と環境変数管理の改善に関する実装方針を定義します。

### 機能改善の概要

1. **ルーレットアニメーションの修正**: アニメーションと結果画面のメンバーを一致させる
2. **環境変数管理**: Viteを使ってAPI URLを環境変数で管理
3. **ビルドシステムの改善**: Viteによる最適化とGitHub Actions自動デプロイ
4. **UIバグ修正**: ロール入力フィールドの同期とアニメーション画面での非表示

### 設計方針

- 既存のコンポーネント構造を維持
- Viteを導入してビルドプロセスを最適化
- 環境変数でAPI URLを管理し、コードからハードコードを削除
- GitHub Actionsで自動ビルド＆デプロイを実現

## アーキテクチャ

### ビルドシステムの変更

**変更前**:
```
静的ファイル → GitHub Pages
```

**変更後**:
```
ソースコード → Vite ビルド → dist/ → GitHub Actions → GitHub Pages
                    ↑
              環境変数注入
```

### 環境変数の管理

**開発環境**:
- `.env` ファイルから環境変数を読み込み
- `VITE_API_URL=http://localhost:3000`

**本番環境**:
- GitHub Secretsから環境変数を注入
- `VITE_API_URL=https://your-app.onrender.com`

## コンポーネントとインターフェース

### config.js の変更

**変更前**:
```javascript
get apiEndpoint() {
    const params = new URLSearchParams(window.location.search);
    const apiUrl = params.get('api_url');
    if (apiUrl) return apiUrl;
    return 'http://localhost:3000';
}
```

**変更後**:
```javascript
get apiEndpoint() {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
        console.error('VITE_API_URL が設定されていません');
        return 'http://localhost:3000';
    }
    return apiUrl;
}
```

### UIController の変更

#### animateRoulette メソッドの修正

**変更内容**:
- ルーレットホイールに除外後の全メンバー（`availableMembers`）を表示
- 針が止まる位置は、開始時に選出された `selected` メンバーを順に指す
- 最後のアニメーション終了後、1秒待ってから結果ボタンを表示
- アニメーション画面では、ロール入力フィールドを非表示

```javascript
async animateRoulette(members, selected) {
    // ロール入力フィールドを非表示
    const roleContainer = document.getElementById('role-input-container');
    if (roleContainer) roleContainer.style.display = 'none';
    
    // ルーレットホイールを初期化（除外後の全メンバーを表示）
    this.rouletteWheel = new RouletteWheel(wheelContainer);
    this.rouletteWheel.initialize(members);
    
    // 各選出メンバーに対してルーレットを回す
    for (let i = 0; i < selected.length; i++) {
        await this.rouletteWheel.spin(selected[i]);
        if (i < selected.length - 1) {
            await this.sleep(500);
        }
    }
    
    // 最後のアニメーション終了後1秒待ってからボタンを表示
    await this.sleep(1000);
    
    if (this.elements.showResultsContainer) {
        this.elements.showResultsContainer.classList.remove('hidden');
    }
}
```

#### updateRoleInputFields メソッドの修正

**変更内容**:
- 選出人数が減少した場合、余分なフィールドを即座に削除（DOMから削除）

```javascript
updateRoleInputFields(count) {
    const fieldsWrapper = document.getElementById('role-input-fields');
    if (!fieldsWrapper) return;

    const currentInputs = fieldsWrapper.querySelectorAll('.role-input-wrapper');
    const currentCount = currentInputs.length;

    if (count > currentCount) {
        // フィールドを追加
        for (let i = currentCount; i < count; i++) {
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'role-input-wrapper';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'role-input';
            input.placeholder = `ロール ${i + 1}`;
            input.dataset.index = i;
            inputWrapper.appendChild(input);
            fieldsWrapper.appendChild(inputWrapper);
        }
    } else if (count < currentCount) {
        // フィールドを削除（後ろから削除）
        for (let i = currentCount - 1; i >= count; i--) {
            const wrapper = currentInputs[i];
            wrapper.remove();
        }
    }
}
```

### AppController の変更

#### handleRouletteExecution メソッドの修正

**変更内容**:
- 結果を先に保存してからアニメーションを実行
- `availableMembers` と `selected` を `animateRoulette` に渡す

```javascript
async handleRouletteExecution(count) {
    try {
        const excludedIds = this.ui.getExcludedMemberIds();
        const roles = this.ui.getRoles();
        const availableMembers = this.currentMembers.filter(
            member => !excludedIds.includes(member.id)
        );

        const selected = this.rouletteEngine.selectMembersWithExclusion(
            this.currentMembers, 
            count, 
            excludedIds
        );

        const selectedWithRoles = this.rouletteEngine.assignRoles(selected, roles);

        // 結果を先に保存（ロール情報を含む）
        this.ui.currentSelectedMembers = selectedWithRoles;

        // アニメーション表示（除外後の全メンバーと選出されたメンバーを渡す）
        await this.ui.animateRoulette(availableMembers, selected);

        // 履歴に保存
        this.resultManager.saveToHistory({
            guildId: this.currentGuildId,
            channelId: this.currentChannelId,
            totalMembers: this.currentMembers.length,
            selectedCount: count,
            selectedMembers: selectedWithRoles
        });
    } catch (error) {
        console.error('[AppController] ルーレット実行エラー:', error);
        this.ui.showError('ルーレットの実行に失敗しました。');
    }
}
```

### Discord Bot の変更

#### URL生成の修正

**変更内容**:
- `api_url` パラメータを削除
- フロントエンドのURLとトークンのみを含む

```javascript
// URL を生成（トークンのみを含む）
const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
const rouletteUrl = `${frontendUrl}?token=${token}`;

await interaction.reply({
    content: `🎰 ボイスルーレットの URL を生成しました！\n\n${rouletteUrl}\n\n⏰ この URL は1時間有効です。`,
    ephemeral: true,
});
```

## Vite設定

### vite.config.js

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages用のベースパス
  base: '/roulette/',
  
  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  
  // 開発サーバー設定
  server: {
    port: 5500,
    open: true,
  },
  
  // 環境変数のプレフィックス
  envPrefix: 'VITE_',
});
```

### 環境変数ファイル

**.env** (開発環境):
```env
VITE_API_URL=http://localhost:3000
```

**.env.example** (テンプレート):
```env
# 開発環境
VITE_API_URL=http://localhost:3000

# 本番環境（GitHub Actionsで上書き）
# VITE_API_URL=https://your-app.onrender.com
```

## GitHub Actions ワークフロー

### .github/workflows/deploy.yml

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
        run: npm run build
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
  
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## データモデル

### 環境変数

```javascript
{
  VITE_API_URL: string  // バックエンドAPIのURL
}
```

### ビルド成果物

```
dist/
├── index.html
└── assets/
    ├── index-[hash].js
    ├── index-[hash].js.map
    └── index-[hash].css
```

## エラーハンドリング

### 環境変数が未設定の場合

**エラーケース**: `VITE_API_URL` が設定されていない

**処理**:
- コンソールにエラーメッセージを出力
- フォールバック値（`http://localhost:3000`）を使用

### ビルドエラー

**エラーケース**: GitHub Actionsでビルドが失敗

**処理**:
- ワークフローを停止
- エラーメッセージを表示
- デプロイを実行しない

### 404エラー

**エラーケース**: GitHub Pagesでファイルが見つからない

**処理**:
- ベースパスが正しく設定されているか確認
- ビルド成果物が正しくデプロイされているか確認

## デプロイフロー

1. **ローカルで開発**
   - `npm run dev` で開発サーバーを起動
   - `.env` ファイルから環境変数を読み込み

2. **コミット＆プッシュ**
   - `git push origin main`
   - GitHub Actionsが自動的にトリガー

3. **ビルド**
   - GitHub Actionsが依存関係をインストール
   - 環境変数を注入してビルド実行
   - `dist/` ディレクトリに成果物を生成

4. **デプロイ**
   - ビルド成果物をGitHub Pagesにデプロイ
   - 新しいバージョンが公開される

## セキュリティ

- API URLは環境変数で管理され、コードに含まれない
- GitHub Secretsで本番環境の環境変数を管理
- `.env` ファイルは `.gitignore` に追加され、リポジトリに含まれない
- ビルド時にのみ環境変数が注入される

## パフォーマンス

- Viteによる最適化されたビルド
- ハッシュ付きファイル名によるキャッシュ最適化
- ソースマップによるデバッグ支援
- 開発サーバーの高速なHMR（Hot Module Replacement）
