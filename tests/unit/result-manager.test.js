/**
 * @jest-environment jsdom
 */

/**
 * ResultManager のユニットテスト
 */
import { ResultManager } from '../../js/result-manager.js';

describe('ResultManager', () => {
    let manager;
    let writeTextCalls;

    beforeEach(() => {
        manager = new ResultManager();
        writeTextCalls = [];
        
        // クリップボード API のモック
        Object.defineProperty(navigator, 'clipboard', {
            value: {
                writeText: (text) => {
                    writeTextCalls.push(text);
                    return Promise.resolve();
                }
            },
            writable: true,
            configurable: true
        });
    });

    describe('copyToClipboard - 既存フォーマット（後方互換性）', () => {
        test('ロールなしの場合、既存フォーマットでコピーされる', async () => {
            const members = [
                { displayName: '太郎' },
                { displayName: '花子' },
                { displayName: '次郎' }
            ];

            const result = await manager.copyToClipboard(members, false);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎\n2. 花子\n3. 次郎');
        });

        test('withRoles パラメータを省略した場合、既存フォーマットでコピーされる', async () => {
            const members = [
                { displayName: '太郎' },
                { displayName: '花子' }
            ];

            const result = await manager.copyToClipboard(members);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎\n2. 花子');
        });
    });

    describe('copyToClipboard - ロール付きフォーマット', () => {
        test('ロール付きの場合、ロールを含むフォーマットでコピーされる', async () => {
            const membersWithRoles = [
                { member: { displayName: '太郎' }, role: 'リーダー' },
                { member: { displayName: '花子' }, role: 'サポート' },
                { member: { displayName: '次郎' }, role: 'メンバー' }
            ];

            const result = await manager.copyToClipboard(membersWithRoles, true);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎 - リーダー\n2. 花子 - サポート\n3. 次郎 - メンバー');
        });

        test('一部のメンバーのみロールがある場合、ロールなしメンバーは名前のみ表示', async () => {
            const membersWithRoles = [
                { member: { displayName: '太郎' }, role: 'リーダー' },
                { member: { displayName: '花子' }, role: null },
                { member: { displayName: '次郎' }, role: 'サポート' }
            ];

            const result = await manager.copyToClipboard(membersWithRoles, true);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎 - リーダー\n2. 花子\n3. 次郎 - サポート');
        });

        test('すべてのメンバーがロールなしの場合、名前のみ表示', async () => {
            const membersWithRoles = [
                { member: { displayName: '太郎' }, role: null },
                { member: { displayName: '花子' }, role: null }
            ];

            const result = await manager.copyToClipboard(membersWithRoles, true);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎\n2. 花子');
        });

        test('空文字列のロールは null として扱われる', async () => {
            const membersWithRoles = [
                { member: { displayName: '太郎' }, role: '' },
                { member: { displayName: '花子' }, role: 'サポート' }
            ];

            const result = await manager.copyToClipboard(membersWithRoles, true);

            expect(result).toBe(true);
            expect(writeTextCalls[0]).toBe('1. 太郎\n2. 花子 - サポート');
        });
    });

    describe('copyToClipboard - エラーハンドリング', () => {
        test('クリップボード API が失敗した場合、false を返す', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: () => Promise.reject(new Error('Failed'))
                },
                writable: true,
                configurable: true
            });

            const members = [{ displayName: '太郎' }];
            const result = await manager.copyToClipboard(members);

            expect(result).toBe(false);
        });
    });
});
