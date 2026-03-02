/**
 * RouletteEngine のユニットテスト
 */
import { RouletteEngine } from '../../js/roulette-engine.js';

describe('RouletteEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new RouletteEngine();
    });

    describe('selectMembersWithExclusion', () => {
        const createMembers = (count) => {
            return Array.from({ length: count }, (_, i) => ({
                id: `user${i + 1}`,
                displayName: `User ${i + 1}`,
                avatar: null
            }));
        };

        test('除外リストが空の場合、既存のselectMembersと同じ動作をする', () => {
            const members = createMembers(5);
            const result = engine.selectMembersWithExclusion(members, 3, []);
            
            expect(result).toHaveLength(3);
            expect(result.every(m => members.includes(m))).toBe(true);
        });

        test('除外リストがnullの場合、既存のselectMembersと同じ動作をする', () => {
            const members = createMembers(5);
            const result = engine.selectMembersWithExclusion(members, 3, null);
            
            expect(result).toHaveLength(3);
            expect(result.every(m => members.includes(m))).toBe(true);
        });

        test('除外されたメンバーは選出されない', () => {
            const members = createMembers(5);
            const excludedIds = ['user1', 'user2'];
            const result = engine.selectMembersWithExclusion(members, 2, excludedIds);
            
            expect(result).toHaveLength(2);
            expect(result.every(m => !excludedIds.includes(m.id))).toBe(true);
        });

        test('すべてのメンバーが除外された場合、エラーをスローする', () => {
            const members = createMembers(3);
            const excludedIds = ['user1', 'user2', 'user3'];
            
            expect(() => {
                engine.selectMembersWithExclusion(members, 1, excludedIds);
            }).toThrow();
        });

        test('選出人数が選出可能なメンバー数を超える場合、エラーをスローする', () => {
            const members = createMembers(5);
            const excludedIds = ['user1', 'user2', 'user3'];
            
            expect(() => {
                engine.selectMembersWithExclusion(members, 3, excludedIds);
            }).toThrow();
        });

        test('選出可能なメンバー数と同じ人数を選出できる', () => {
            const members = createMembers(5);
            const excludedIds = ['user1', 'user2'];
            const result = engine.selectMembersWithExclusion(members, 3, excludedIds);
            
            expect(result).toHaveLength(3);
            expect(result.every(m => !excludedIds.includes(m.id))).toBe(true);
        });

        test('除外リストに存在しないIDが含まれていても正常に動作する', () => {
            const members = createMembers(5);
            const excludedIds = ['user1', 'nonexistent'];
            const result = engine.selectMembersWithExclusion(members, 3, excludedIds);
            
            expect(result).toHaveLength(3);
            expect(result.every(m => !excludedIds.includes(m.id))).toBe(true);
        });
    });

    describe('assignRoles', () => {
        const createMembers = (count) => {
            return Array.from({ length: count }, (_, i) => ({
                id: `user${i + 1}`,
                displayName: `User ${i + 1}`,
                avatar: null
            }));
        };

        test('ロールが空の場合、すべてのメンバーに null を割り当てる', () => {
            const members = createMembers(3);
            const result = engine.assignRoles(members, []);

        expect(result).toHaveLength(3);
        expect(result.every(item => item.role === null)).toBe(true);
        expect(result.every(item => members.includes(item.member))).toBe(true);
    });

    test('ロールが入力されていない場合（空文字列のみ）、すべてのメンバーに null を割り当てる', () => {
        const members = createMembers(3);
        const result = engine.assignRoles(members, ['', '  ', '']);

        expect(result).toHaveLength(3);
        expect(result.every(item => item.role === null)).toBe(true);
    });

    test('ロール数がメンバー数と同じ場合、すべてのメンバーにロールを割り当てる', () => {
        const members = createMembers(3);
        const roles = ['リーダー', 'サポート', 'アタッカー'];
        const result = engine.assignRoles(members, roles);

        expect(result).toHaveLength(3);
        expect(result.every(item => item.role !== null)).toBe(true);

        // すべてのロールが割り当てられていることを確認
        const assignedRoles = result.map(item => item.role);
        roles.forEach(role => {
            expect(assignedRoles).toContain(role);
        });
    });

    test('ロール数がメンバー数より少ない場合、一部のメンバーに null を割り当てる', () => {
        const members = createMembers(5);
        const roles = ['リーダー', 'サポート'];
        const result = engine.assignRoles(members, roles);

        expect(result).toHaveLength(5);

        // 2つのロールが割り当てられ、3つは null
        const withRoles = result.filter(item => item.role !== null);
        const withoutRoles = result.filter(item => item.role === null);

        expect(withRoles).toHaveLength(2);
        expect(withoutRoles).toHaveLength(3);

        // 割り当てられたロールが入力されたロールと一致することを確認
        const assignedRoles = withRoles.map(item => item.role);
        roles.forEach(role => {
            expect(assignedRoles).toContain(role);
        });
    });

    test('一部のロールのみ入力されている場合（空文字列を含む）、入力されたロールのみを割り当てる', () => {
        const members = createMembers(4);
        const roles = ['リーダー', '', 'サポート', ''];
        const result = engine.assignRoles(members, roles);

        expect(result).toHaveLength(4);

        // 2つのロールが割り当てられ、2つは null
        const withRoles = result.filter(item => item.role !== null);
        const withoutRoles = result.filter(item => item.role === null);

        expect(withRoles).toHaveLength(2);
        expect(withoutRoles).toHaveLength(2);

        // 割り当てられたロールが入力されたロール（空文字列を除く）と一致することを確認
        const assignedRoles = withRoles.map(item => item.role);
        expect(assignedRoles).toContain('リーダー');
        expect(assignedRoles).toContain('サポート');
    });

    test('各ロールは正確に1回ずつ割り当てられる', () => {
        const members = createMembers(3);
        const roles = ['リーダー', 'サポート', 'アタッカー'];
        const result = engine.assignRoles(members, roles);

        const assignedRoles = result.map(item => item.role);

        // 各ロールが正確に1回ずつ出現することを確認
        roles.forEach(role => {
            const count = assignedRoles.filter(r => r === role).length;
            expect(count).toBe(1);
        });
    });

    test('ロールがシャッフルされて割り当てられる', () => {
        const members = createMembers(3);
        const roles = ['ロール1', 'ロール2', 'ロール3'];

        // 複数回実行して、少なくとも1回は異なる順序になることを確認
        const results = [];
        for (let i = 0; i < 10; i++) {
            const result = engine.assignRoles(members, roles);
            results.push(result.map(item => item.role).join(','));
        }

        // すべての結果が同じでないことを確認（シャッフルされている）
        const uniqueResults = new Set(results);
        expect(uniqueResults.size).toBeGreaterThan(1);
    });

    test('メンバー情報が正しく保持される', () => {
        const members = createMembers(3);
        const roles = ['リーダー', 'サポート', 'アタッカー'];
        const result = engine.assignRoles(members, roles);

        // すべてのメンバーが結果に含まれていることを確認
        members.forEach(member => {
            const found = result.find(item => item.member === member);
            expect(found).toBeDefined();
        });
    });
    });
});
