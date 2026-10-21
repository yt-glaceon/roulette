/**
 * 開発用モック Discord クライアントのテスト
 */

import { MockDiscordClient, createMockDiscordClient } from '../../js/dev/mock-discord-client.js';
import { buildMockChannels } from '../../js/dev/mock-data.js';

describe('MockDiscordClient', () => {
    let client;

    beforeEach(() => {
        client = new MockDiscordClient(buildMockChannels(null), { delayMs: 0 });
    });

    test('validateToken は有効な結果を返す', async () => {
        await expect(client.validateToken()).resolves.toEqual({ valid: true, guildId: 'mock-guild' });
    });

    test('getGuild はギルド情報を返す', async () => {
        const guild = await client.getGuild();
        expect(guild.id).toBe('mock-guild');
        expect(guild.name).toContain('【モック】');
    });

    test('getChannels は memberCount 付きで position 昇順に返す', async () => {
        const channels = await client.getChannels();
        expect(channels).toHaveLength(5);
        channels.forEach(c => {
            expect(Object.keys(c).sort()).toEqual(['id', 'memberCount', 'name', 'position']);
        });
        const positions = channels.map(c => c.position);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        for (const c of channels) {
            const members = await client.getVoiceChannelMembers(c.id);
            expect(c.memberCount).toBe(members.length);
        }
    });

    test('getVoiceChannelMembers は返り値を書き換えても元データに影響しない', async () => {
        const first = await client.getVoiceChannelMembers('mock-normal');
        first[0].displayName = '書き換え';
        first.pop();
        const second = await client.getVoiceChannelMembers('mock-normal');
        expect(second).toHaveLength(8);
        expect(second[0].displayName).not.toBe('書き換え');
    });

    test('未知のチャネル id は NOT_FOUND で reject する', async () => {
        await expect(client.getVoiceChannelMembers('unknown')).rejects.toMatchObject({
            type: 'NOT_FOUND',
            status: 404
        });
    });
});

describe('createMockDiscordClient', () => {
    test('?mock=12 で 12 人のチャネルが含まれる', async () => {
        const client = createMockDiscordClient(new URLSearchParams('mock=12'), { delayMs: 0 });
        const channels = await client.getChannels();
        expect(channels[0].id).toBe('mock-custom');
        expect(channels[0].memberCount).toBe(12);
    });

    test('値なしの ?mock ではプリセットのみ', async () => {
        const client = createMockDiscordClient(new URLSearchParams('mock'), { delayMs: 0 });
        const channels = await client.getChannels();
        expect(channels.find(c => c.id === 'mock-custom')).toBeUndefined();
        expect(channels).toHaveLength(5);
    });
});
