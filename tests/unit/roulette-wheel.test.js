/**
 * RouletteWheel のユニットテスト
 */
import { jest } from '@jest/globals';
import fc from 'fast-check';
import { RouletteWheel } from '../../js/animations/roulette-wheel.js';

describe('RouletteWheel', () => {
    let container;
    let wheel;

    beforeEach(() => {
        // Canvas API のモックを作成
        const mockContext = {
            clearRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            arc: () => {},
            closePath: () => {},
            fill: () => {},
            stroke: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            fillText: () => {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            textAlign: '',
            font: ''
        };
        
        HTMLCanvasElement.prototype.getContext = () => mockContext;

        // DOM コンテナを作成
        container = document.createElement('div');
        document.body.appendChild(container);
        wheel = new RouletteWheel(container);
    });

    afterEach(() => {
        // クリーンアップ
        if (wheel) {
            wheel.destroy();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('initialize', () => {
        test('除外後のメンバーリストでルーレットを初期化できる', () => {
            const members = [
                { id: 'user1', displayName: 'User 1', avatar: null },
                { id: 'user2', displayName: 'User 2', avatar: null },
                { id: 'user3', displayName: 'User 3', avatar: null }
            ];

            wheel.initialize(members);

            // メンバーが正しく設定されているか確認
            expect(wheel.members).toEqual(members);
            expect(wheel.members.length).toBe(3);
        });

        test('セクション数が除外後のメンバー数と一致する', () => {
            // 5人のメンバーから2人を除外した場合
            const allMembers = [
                { id: 'user1', displayName: 'User 1', avatar: null },
                { id: 'user2', displayName: 'User 2', avatar: null },
                { id: 'user3', displayName: 'User 3', avatar: null },
                { id: 'user4', displayName: 'User 4', avatar: null },
                { id: 'user5', displayName: 'User 5', avatar: null }
            ];
            const excludedIds = ['user1', 'user2'];
            const availableMembers = allMembers.filter(m => !excludedIds.includes(m.id));

            wheel.initialize(availableMembers);

            // セクション数が除外後のメンバー数（3人）と一致することを確認
            expect(wheel.members.length).toBe(3);
            expect(wheel.members).toEqual(availableMembers);
            
            // キャンバスが作成されていることを確認
            expect(wheel.canvas).toBeTruthy();
            expect(wheel.ctx).toBeTruthy();
        });

        test('除外されたメンバーがルーレットに含まれていない', () => {
            const allMembers = [
                { id: 'user1', displayName: 'User 1', avatar: null },
                { id: 'user2', displayName: 'User 2', avatar: null },
                { id: 'user3', displayName: 'User 3', avatar: null }
            ];
            const excludedIds = ['user2'];
            const availableMembers = allMembers.filter(m => !excludedIds.includes(m.id));

            wheel.initialize(availableMembers);

            // 除外されたメンバーが含まれていないことを確認
            expect(wheel.members.some(m => m.id === 'user2')).toBe(false);
            expect(wheel.members.length).toBe(2);
            expect(wheel.members.map(m => m.id)).toEqual(['user1', 'user3']);
        });

        test('すべてのメンバーが除外されていない場合、全員が表示される', () => {
            const members = [
                { id: 'user1', displayName: 'User 1', avatar: null },
                { id: 'user2', displayName: 'User 2', avatar: null }
            ];

            wheel.initialize(members);

            expect(wheel.members.length).toBe(2);
            expect(wheel.members).toEqual(members);
        });

        test('1人のメンバーでもルーレットを初期化できる', () => {
            const members = [
                { id: 'user1', displayName: 'User 1', avatar: null }
            ];

            wheel.initialize(members);

            expect(wheel.members.length).toBe(1);
            expect(wheel.members).toEqual(members);
        });
    });

    describe('spin(相対回転・区画内ランダム停止)', () => {
        const makeMembers = (n) => Array.from({ length: n }, (_, i) => ({
            id: `user${i}`, displayName: `User${i}`, avatar: null
        }));

        // 針(3π/2)の区画内での位置を 0〜1 の比率で返す
        const pointerRatio = (w) => {
            const relative = wheel.normalizeAngle(Math.PI * 3 / 2 - wheel.rotation);
            return (relative % w) / w;
        };

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('1回目も2回目以降も、針が当選者を指す(人数1〜30、連続1〜5回)', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    fc.array(fc.nat({ max: 29 }), { minLength: 1, maxLength: 5 }),
                    async (n, picks) => {
                        const members = makeMembers(n);
                        wheel.initialize(members);
                        for (const p of picks) {
                            const winner = members[p % n];
                            await wheel.spin(winner, { duration: 20 });
                            if (wheel.getPointerIndex() !== p % n) return false;
                        }
                        return true;
                    }
                ),
                { numRuns: 15 }
            );
        }, 30000);

        test('2回目の spin 開始時の回転角は1回目終了時と同じ(0に戻らない)', async () => {
            const members = makeMembers(5);
            wheel.initialize(members);
            await wheel.spin(members[1], { duration: 20 });
            const afterFirst = wheel.rotation;
            expect(afterFirst).toBeGreaterThan(0);

            const rotations = [];
            const origDraw = wheel.draw.bind(wheel);
            wheel.draw = () => { rotations.push(wheel.rotation); origDraw(); };
            await wheel.spin(members[3], { duration: 20 });

            // 最初の描画は開始角(easeOut(0) = 0)なので1回目終了時の角度と一致する
            expect(rotations[0]).toBe(afterFirst);
            expect(wheel.rotation).toBeGreaterThan(afterFirst);
        });

        test.each([0, 0.999])('Math.random=%s でも停止位置が区画境界から15%%以上離れる', async (value) => {
            jest.spyOn(Math, 'random').mockReturnValue(value);
            const members = makeMembers(30);
            wheel.initialize(members);
            const w = (Math.PI * 2) / members.length;
            await wheel.spin(members[7], { duration: 20 });
            expect(wheel.getPointerIndex()).toBe(7);
            const ratio = pointerRatio(w);
            expect(ratio).toBeGreaterThanOrEqual(0.15 - 1e-9);
            expect(ratio).toBeLessThanOrEqual(0.85 + 1e-9);
        });

        test('最低回転数(minRotations)以上回る', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    fc.integer({ min: 1, max: 6 }),
                    async (n, minRotations) => {
                        const members = makeMembers(n);
                        wheel.initialize(members);
                        const before = wheel.rotation;
                        await wheel.spin(members[n - 1], { duration: 20, minRotations });
                        return (wheel.rotation - before) / (Math.PI * 2) >= minRotations - 1e-9;
                    }
                ),
                { numRuns: 15 }
            );
        }, 30000);

        test('アニメーション時間が指定された duration と一致する', async () => {
            const members = makeMembers(2);
            wheel.initialize(members);
            const duration = 1000;
            const start = Date.now();
            await wheel.spin(members[0], { duration });
            const actual = Date.now() - start;
            expect(actual).toBeGreaterThanOrEqual(duration - 100);
            expect(actual).toBeLessThanOrEqual(duration + 100);
        });
    });

    describe('updateMembers', () => {
        test('回転角が保たれ、次の spin 後に針が当選者を指す', async () => {
            const members = Array.from({ length: 6 }, (_, i) => ({
                id: `user${i}`, displayName: `User${i}`, avatar: null
            }));
            wheel.initialize(members);
            await wheel.spin(members[2], { duration: 20 });
            const rotation = wheel.rotation;

            const remaining = members.filter(m => m.id !== 'user2');
            wheel.updateMembers(remaining);
            expect(wheel.members).toBe(remaining);
            expect(wheel.rotation).toBe(rotation);

            await wheel.spin(remaining[3], { duration: 20 });
            expect(wheel.getPointerIndex()).toBe(3);
        });
    });

    describe('destroy', () => {
        test('destroy 後は rAF のコールバックで描画されない', async () => {
            const callbacks = [];
            const spyRaf = jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
                callbacks.push(cb);
                return callbacks.length;
            });
            const spyCancel = jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
            const members = [
                { id: 'a', displayName: 'A', avatar: null },
                { id: 'b', displayName: 'B', avatar: null }
            ];
            wheel.initialize(members);
            const p = wheel.spin(members[0], { duration: 1000 });
            expect(callbacks.length).toBe(1);

            const drawSpy = jest.spyOn(wheel, 'draw');
            wheel.destroy();
            expect(spyCancel).toHaveBeenCalled();
            await p; // destroy で Promise は resolve される
            expect(drawSpy).not.toHaveBeenCalled();

            // キャンセルされず残った rAF コールバックを実行しても描画されない
            const rafCallsBefore = spyRaf.mock.calls.length;
            callbacks.forEach(cb => cb());
            expect(drawSpy).not.toHaveBeenCalled();
            expect(spyRaf.mock.calls.length).toBe(rafCallsBefore);
            spyRaf.mockRestore();
            spyCancel.mockRestore();
        });
    });

    describe('spin(当選者不在)', () => {
        test('当選者が members にいないと reject され、isSpinning は立たない', async () => {
            const members = [
                { id: 'a', displayName: 'A', avatar: null },
                { id: 'b', displayName: 'B', avatar: null }
            ];
            wheel.initialize(members);
            await expect(wheel.spin({ id: 'zzz', displayName: 'Z', avatar: null }, { duration: 20 }))
                .rejects.toThrow();
            expect(wheel.isSpinning).toBe(false);
            expect(wheel.rotation).toBe(0);
        });
    });
});
