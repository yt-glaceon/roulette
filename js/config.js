// Discord アプリケーション設定
export const config = {
    // Client ID は URL パラメータから取得
    // 例: https://yt-glaceon.github.io/roulette/?client_id=YOUR_CLIENT_ID
    get discordClientId() {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('client_id');
        
        if (!clientId) {
            console.warn('Client ID が指定されていません。URL に ?client_id=YOUR_CLIENT_ID を追加してください。');
        }
        
        return clientId;
    },
    
    // GitHub Pages のリダイレクト URI（固定値）
    redirectUri: 'https://yt-glaceon.github.io/roulette/callback.html',
    
    // 必要な Discord API スコープ
    scopes: ['guilds', 'guilds.members.read'],
    
    // Discord API エンドポイント
    apiEndpoint: 'https://discord.com/api/v10',
    
    // OAuth2 認証エンドポイント
    authEndpoint: 'https://discord.com/api/oauth2/authorize'
};
