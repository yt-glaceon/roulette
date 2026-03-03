import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages用のベースパス
  // リポジトリ名が discord-voice-roulette の場合
  base: '/discord-voice-roulette/',
  
  // ビルド設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // ソースマップを生成（デバッグ用）
    sourcemap: true,
  },
  
  // 開発サーバー設定
  server: {
    port: 5500,
    open: true,
  },
  
  // 環境変数のプレフィックス
  // VITE_ で始まる環境変数のみクライアントに公開
  envPrefix: 'VITE_',
});
