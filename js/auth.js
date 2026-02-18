import { config } from './config.js';

/**
 * 認証モジュール
 * Discord OAuth2 認証フローを管理
 */
export class AuthModule {
    constructor() {
        this.tokenKey = 'discord_token';
    }

    /**
     * Discord OAuth2 認証を開始
     * Implicit Grant フローを使用
     */
    initiateAuth() {
        const clientId = config.discordClientId;
        
        if (!clientId) {
            throw new Error('Discord Client ID が設定されていません');
        }

        // Client ID を一時保存（callback で使用）
        localStorage.setItem('temp_client_id', clientId);

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: config.redirectUri,
            response_type: 'token',
            scope: config.scopes.join(' ')
        });

        const authUrl = `${config.authEndpoint}?${params.toString()}`;
        window.location.href = authUrl;
    }

    /**
     * OAuth2 コールバックを処理
     * @param {string} hash - URL ハッシュ（#access_token=...）
     * @returns {string|null} アクセストークン
     */
    handleCallback(hash) {
        try {
            // ハッシュから # を除去
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const error = params.get('error');

            if (error) {
                throw new Error(`認証エラー: ${error}`);
            }

            if (accessToken) {
                this.saveToken(accessToken);
                return accessToken;
            }

            return null;
        } catch (error) {
            console.error('[AuthModule] コールバック処理エラー:', error);
            throw error;
        }
    }

    /**
     * トークンを保存
     * @param {string} token - アクセストークン
     */
    saveToken(token) {
        try {
            localStorage.setItem(this.tokenKey, token);
        } catch (error) {
            console.error('[AuthModule] トークン保存エラー:', error);
            throw new Error('トークンの保存に失敗しました');
        }
    }

    /**
     * 保存されたトークンを取得
     * @returns {string|null} アクセストークン
     */
    getToken() {
        try {
            return localStorage.getItem(this.tokenKey);
        } catch (error) {
            console.error('[AuthModule] トークン取得エラー:', error);
            return null;
        }
    }

    /**
     * 認証状態を確認
     * @returns {boolean} 認証済みかどうか
     */
    isAuthenticated() {
        const token = this.getToken();
        return token !== null && token !== '';
    }

    /**
     * ログアウト処理
     * ローカルストレージから認証情報を削除
     */
    logout() {
        try {
            localStorage.removeItem(this.tokenKey);
            // 履歴も削除する場合はここに追加
            // localStorage.removeItem('roulette_history');
        } catch (error) {
            console.error('[AuthModule] ログアウトエラー:', error);
        }
    }
}
