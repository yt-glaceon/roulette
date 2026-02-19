// アプリケーション設定
export const config = {
    // バックエンドサーバーのURL
    // 開発環境: http://localhost:3000
    // 本番環境: Render のデプロイURL（例: https://your-app.onrender.com）
    get apiEndpoint() {
        // URL パラメータから API エンドポイントを取得可能にする
        const params = new URLSearchParams(window.location.search);
        const apiUrl = params.get('api_url');
        
        if (apiUrl) {
            return apiUrl;
        }
        
        // デフォルトは開発環境のURL
        // 本番環境では ?api_url=https://your-app.onrender.com を URL に追加
        return 'http://localhost:3000';
    }
};
