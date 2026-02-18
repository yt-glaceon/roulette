// Discord アプリケーション設定
export const config = {
    // Discord Developer Portal で取得した Client ID を設定してください
    discordClientId: 'YOUR_CLIENT_ID_HERE',
    
    // GitHub Pages の URL に合わせて変更してください
    // 例: 'https://yourusername.github.io/discord-voice-roulette/callback.html'
    redirectUri: window.location.origin + '/callback.html',
    
    // 必要な Discord API スコープ
    scopes: ['guilds', 'guilds.members.read'],
    
    // Discord API エンドポイント
    apiEndpoint: 'https://discord.com/api/v10',
    
    // OAuth2 認証エンドポイント
    authEndpoint: 'https://discord.com/api/oauth2/authorize'
};
