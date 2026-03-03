// アプリケーション設定
export const config = {
    // バックエンドサーバーのURL
    // Viteの環境変数から取得
    get apiEndpoint() {
        // import.meta.env.VITE_API_URL は Vite によって注入される
        const apiUrl = import.meta.env.VITE_API_URL;
        
        if (!apiUrl) {
            console.error('VITE_API_URL が設定されていません');
            // フォールバック（開発環境）
            return 'http://localhost:3000';
        }
        
        return apiUrl;
    }
};
