import { config } from './config.js';

/**
 * Discord API クライアント（バックエンド経由・トークンベース）
 * バックエンドサーバーの REST API と通信
 */
export class DiscordClient {
    constructor(accessToken) {
        this.apiEndpoint = config.apiEndpoint;
        this.accessToken = accessToken;
    }

    /**
     * API リクエストを実行
     * @param {string} endpoint - API エンドポイント
     * @param {Object} options - リクエストオプション
     * @returns {Promise<Object>} レスポンス
     */
    async request(endpoint, options = {}) {
        const url = `${this.apiEndpoint}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${this.accessToken}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            // エラーハンドリング
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                if (response.status === 401) {
                    throw {
                        type: 'AUTH_ERROR',
                        status: 401,
                        message: errorData.error || 'トークンが無効または期限切れです。',
                        details: errorData
                    };
                }

                if (response.status === 404) {
                    throw {
                        type: 'NOT_FOUND',
                        status: 404,
                        message: 'リソースが見つかりません。',
                        details: errorData
                    };
                }

                if (response.status >= 500) {
                    throw {
                        type: 'SERVER_ERROR',
                        status: response.status,
                        message: 'サーバーでエラーが発生しました。',
                        details: errorData
                    };
                }

                throw {
                    type: 'API_ERROR',
                    status: response.status,
                    message: errorData.error || `API エラー: ${response.status}`,
                    details: errorData
                };
            }

            return await response.json();
        } catch (error) {
            // ネットワークエラー
            if (error instanceof TypeError) {
                throw {
                    type: 'NETWORK_ERROR',
                    message: 'ネットワークエラーが発生しました。バックエンドサーバーに接続できません。',
                    originalError: error
                };
            }

            // その他のエラーはそのまま投げる
            throw error;
        }
    }

    /**
     * トークンを検証
     * @returns {Promise<Object>} 検証結果
     */
    async validateToken() {
        try {
            return await this.request('/api/validate-token');
        } catch (error) {
            console.error('[DiscordClient] トークン検証エラー:', error);
            throw error;
        }
    }

    /**
     * ギルド情報を取得
     * @returns {Promise<Object>} ギルド情報
     */
    async getGuild() {
        try {
            return await this.request('/api/guild');
        } catch (error) {
            console.error('[DiscordClient] ギルド取得エラー:', error);
            throw error;
        }
    }

    /**
     * ボイスチャネルリストを取得
     * @returns {Promise<Array>} チャネルリスト
     */
    async getChannels() {
        try {
            return await this.request('/api/guild/channels');
        } catch (error) {
            console.error('[DiscordClient] チャネル取得エラー:', error);
            throw error;
        }
    }

    /**
     * 指定ボイスチャネルのメンバーリストを取得
     * @param {string} channelId - チャネル ID
     * @returns {Promise<Array>} メンバーリスト
     */
    async getVoiceChannelMembers(channelId) {
        try {
            return await this.request(`/api/guild/channels/${channelId}/members`);
        } catch (error) {
            console.error('[DiscordClient] メンバー取得エラー:', error);
            throw error;
        }
    }
}
