/**
 * 開発用モックデータのテスト
 * モックの形が実 API（server/index.js）とずれないよう固定する
 */

import fc from 'fast-check';
import {
    MOCK_GUILD,
    parseMockCount,
    createMockMembers,
    buildMockChannels
} from '../../js/dev/mock-data.js';

describe('parseMockCount', () => {
    test('範囲内の整数文字列は数値を返す', () => {
        expect(parseMockCount('12')).toBe(12);
        expect(parseMockCount('1')).toBe(1);
        expect(parseMockCount('100')).toBe(100);
    });

    test.each(['', null, 'abc', '0', '101', '-3', '2.5'])('%p は null を返す', (value) => {
        expect(parseMockCount(value)).toBeNull();
    });
});

describe('createMockMembers', () => {
    test('実 API と同じ形のメンバーを返す', () => {
        const members = createMockMembers(10);
        expect(members).toHaveLength(10);
        members.forEach(member => {
            expect(typeof member.id).toBe('string');
            expect(typeof member.username).toBe('string');
            expect(typeof member.displayName).toBe('string');
            expect(member.displayName.length).toBeGreaterThan(0);
            if (member.avatar !== null) {
                expect(member.avatar.startsWith('data:image/svg+xml')).toBe(true);
            }
        });
    });

    test('任意の人数で長さが一致し id が重複しない', () => {
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 100 }), (n) => {
                const members = createMockMembers(n);
                expect(members).toHaveLength(n);
                expect(new Set(members.map(m => m.id)).size).toBe(n);
            })
        );
    });

    test('同じ引数で同じ結果を返す', () => {
        expect(createMockMembers(30, { channelKey: 'x' })).toEqual(createMockMembers(30, { channelKey: 'x' }));
    });

    test('names を渡すと先頭から使い、noAvatar で全員アバター無しになる', () => {
        const members = createMockMembers(3, { names: ['A', 'B'], noAvatar: true });
        expect(members.map(m => m.displayName).slice(0, 2)).toEqual(['A', 'B']);
        expect(members.every(m => m.avatar === null)).toBe(true);
    });
});

describe('buildMockChannels', () => {
    test('customCount が null ならプリセット5チャネルを返す', () => {
        const channels = buildMockChannels(null);
        expect(channels.map(c => c.members.length)).toEqual([8, 30, 6, 1, 0]);
        channels.forEach(c => expect(c.name).toContain('【モック】'));
        expect(MOCK_GUILD.name).toContain('【モック】');
    });

    test('チャネルをまたいでも id が重複せず、外部 URL のアバターが無い', () => {
        const members = buildMockChannels(12).flatMap(c => c.members);
        expect(new Set(members.map(m => m.id)).size).toBe(members.length);
        members.forEach(m => {
            if (m.avatar !== null) {
                expect(m.avatar.startsWith('http')).toBe(false);
            }
        });
    });

    test('edge チャネルは全員アバター無しで、長い名前と絵文字始まりの名前を含む', () => {
        const edge = buildMockChannels(null).find(c => c.id === 'mock-edge');
        expect(edge.members.every(m => m.avatar === null)).toBe(true);
        expect(edge.members.some(m => m.displayName.length > 40)).toBe(true);
        expect(edge.members.some(m => /^\p{Extended_Pictographic}/u.test(m.displayName))).toBe(true);
    });

    test('customCount を渡すと先頭にその人数のチャネルが追加される', () => {
        const channels = buildMockChannels(12);
        expect(channels).toHaveLength(6);
        const first = [...channels].sort((a, b) => a.position - b.position)[0];
        expect(first.id).toBe('mock-custom');
        expect(first.members).toHaveLength(12);
    });
});
