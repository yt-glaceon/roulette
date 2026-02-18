import { config } from './config.js';

/**
 * Discord API クライアント
 * Discord REST API との通信を担当
 */
export class DiscordClient {
    /**
     * @param {string} token - アクセストークン
     */
    constructor(token) {
        this.token = token;
        this.apiEndpoint = config.apiEndpoint;
        this.rateLimitRetry = true;
    }

    /**
     * API リクエストを実行
     * @param {string} endpoint - API エンドポイント
     * @param {Object} options - リクエストオプション
     * @returns {Promise<Object>} レスポンス
     */
    async request(endpoint, options = {}) {
        const url = `${this.apiEndpoint}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // レート制限の処理
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
                
                if (this.rateLimitRetry) {
                    console.warn(`[DiscordClient] レート制限: ${retryAfter}秒後に再試行`);
                    await this.sleep(retryAfter * 1000);
                    return this.request(endpoint, options);
                }
                
                throw {
                    type: 'RATE_LIMIT',
                    retryAfter,
                    message: `レート制限に達しました。${retryAfter}秒後に再試行してください。`
                };
            }

            // 認証エラー
            if (response.status === 401) {
                throw {
                    type: 'AUTH_ERROR',
                    status: 401,
                    message: '認証に失敗しました。再度ログインしてください。'
                };
            }

            // 権限エラー
            if (response.status === 403) {
                throw {
                    type: 'PERMISSION_ERROR',
                    status: 403,
                    message: 'このリソースにアクセスする権限がありません。'
                };
            }

            // サーバーエラー
            if (response.status >= 500) {
                throw {
                    type: 'SERVER_ERROR',
                    status: response.status,
                    message: 'Discord サーバーでエラーが発生しました。'
                };
            }

            // その他のエラー
            if (!response.ok) {
                throw {
                    type: 'API_ERROR',
                    status: response.status,
                    message: `API エラー: ${response.status}`
                };
            }

            return await response.json();
        } catch (error) {
            // ネットワークエラー
            if (error instanceof TypeError) {
                throw {
                    type: 'NETWORK_ERROR',
                    message: 'ネットワークエラーが発生しました。接続を確認してください。',
                    originalError: error
                };
            }

            // その他のエラーはそのまま投げる
            throw error;
        }
    }

    /**
     * 指定時間待機
     * @param {number} ms - ミリ秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * ユーザーがアクセス可能なギルドを取得
     * @returns {Promise<Array>} ギルドリスト
     */
    async getGuilds() {
        try {
            const guilds = await this.request('/users/@me/guilds');
            return guilds.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.icon 
                    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
                    : null
            }));
        } catch (error) {
            console.error('[DiscordClient] ギルド取得エラー:', error);
            throw error;
        }
    }

    /**
     * 指定ギルドのチャネルリストを取得
     * @param {string} guildId - ギルド ID
     * @returns {Promise<Array>} チャネルリスト
     */
    async getChannels(guildId) {
        try {
            const channels = await this.request(`/guilds/${guildId}/channels`);
            
            // ボイスチャネル（type: 2）のみをフィルタリング
            return channels
                .filter(channel => channel.type === 2)
                .map(channel => ({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type,
                    guildId: guildId
                }));
        } catch (error) {
            console.error('[DiscordClient] チャネル取得エラー:', error);
            throw error;
        }
    }

    /**
     * 指定ボイスチャネルのメンバーリストを取得
     * @param {string} guildId - ギルド ID
     * @param {string} channelId - チャネル ID
     * @returns {Promise<Array>} メンバーリスト
     */
    async getVoiceChannelMembers(guildId, channelId) {
        try {
            // ギルドの全メンバーを取得
            const members = await this.request(`/guilds/${guildId}/members?limit=1000`);
            
            // ボイスステートを取得してチャネルにいるメンバーをフィルタリング
            const voiceStates = await this.request(`/guilds/${guildId}/voice-states`);
            
            // 指定チャネルにいるメンバーの ID を取得
            const memberIdsInChannel = voiceStates
                .filter(state => state.channel_id === channelId)
                .map(state => state.user_id);

            // メンバー情報を整形
            return members
                .filter(member => memberIdsInChannel.includes(member.user.id))
                .map(member => this.formatMember(member));
        } catch (error) {
            console.error('[DiscordClient] メンバー取得エラー:', error);
            throw error;
        }
    }

    /**
     * メンバー情報を整形
     * @param {Object} member - Discord API のメンバーオブジェクト
     * @returns {Object} 整形されたメンバー情報
     */
    formatMember(member) {
        const user = member.user;
        return {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator || '0',
            avatar: user.avatar
                ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
                : null,
            displayName: member.nick || user.global_name || user.username
        };
    }
}
