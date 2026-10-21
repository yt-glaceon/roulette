import { MOCK_GUILD, parseMockCount, buildMockChannels } from './mock-data.js';

/**
 * 開発用モック Discord クライアント
 * DiscordClient と同じメソッドを、固定データから Promise で返す
 * import.meta.env には依存しない（Jest で直接テストするため）
 */
export class MockDiscordClient {
    /**
     * @param {Array} channels - チャネル定義 [{ id, name, position, members }]
     * @param {Object} options - オプション
     * @param {number} [options.delayMs] - 各メソッドの待ち時間（ミリ秒）
     */
    constructor(channels, { delayMs = 300 } = {}) {
        this.channels = channels;
        this.delayMs = delayMs;
    }

    /**
     * 待ってから値を返す
     * @param {Function} producer - 値（または throw）を生成する関数
     * @returns {Promise<*>} 結果
     */
    async respond(producer) {
        await new Promise(resolve => setTimeout(resolve, this.delayMs));
        return producer();
    }

    /**
     * トークンを検証
     * @returns {Promise<Object>} 検証結果
     */
    validateToken() {
        return this.respond(() => ({ valid: true, guildId: MOCK_GUILD.id }));
    }

    /**
     * ギルド情報を取得
     * @returns {Promise<Object>} ギルド情報
     */
    getGuild() {
        return this.respond(() => ({ ...MOCK_GUILD }));
    }

    /**
     * ボイスチャネルリストを取得
     * @returns {Promise<Array>} チャネルリスト
     */
    getChannels() {
        return this.respond(() => [...this.channels]
            .sort((a, b) => a.position - b.position)
            .map(({ id, name, position, members }) => ({
                id,
                name,
                position,
                memberCount: members.length
            })));
    }

    /**
     * 指定ボイスチャネルのメンバーリストを取得
     * @param {string} channelId - チャネル ID
     * @returns {Promise<Array>} メンバーリスト
     */
    getVoiceChannelMembers(channelId) {
        return this.respond(() => {
            const channel = this.channels.find(c => c.id === channelId);
            if (!channel) {
                throw {
                    type: 'NOT_FOUND',
                    status: 404,
                    message: 'リソースが見つかりません。'
                };
            }
            return channel.members.map(member => ({ ...member }));
        });
    }
}

/**
 * URL パラメータからモッククライアントを作成
 * @param {URLSearchParams} searchParams - URL パラメータ
 * @param {Object} options - MockDiscordClient のオプション
 * @returns {MockDiscordClient} モッククライアント
 */
export function createMockDiscordClient(searchParams, options) {
    const customCount = parseMockCount(searchParams.get('mock'));
    return new MockDiscordClient(buildMockChannels(customCount), options);
}
