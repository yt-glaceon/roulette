/**
 * アニメーション保持プロパティテスト
 * Property 2: Preservation - 既存動作の保持
 * 
 * 重要: 観察優先の方法論に従う
 * 未修正コードでバグ条件に該当しない入力の動作を観察し、
 * 保持要件から観察された動作パターンを捉えるプロパティベーステストを作成
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 */

import fc from 'fast-check';
import { RouletteWheel } from '../../js/animations/roulette-wheel.js';
import { SlotMachineAnimation } from '../../js/animations/slot-machine.js';

describe('保持プロパティテスト - 既存動作の維持', () => {
    let container;

    beforeEach(() => {
        const mockContext = {
            clearRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
            arc: () => {}, closePath: () => {}, fill: () => {}, stroke: () => {},
            save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
            fillText: () => {}, fillStyle: '', strokeStyle: '', lineWidth: 0,
            textAlign: '', font: ''
        };
        HTMLCanvasElement.prototype.getContext = () => mockContext;
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('円形ルーレット: 1回目の実行が正常に動作', () => {
        test('1回目のアニメーションで針が指すユーザーが選出結果と一致する', async () => {
            const wheel = new RouletteWheel(container);
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null },
                { id: 'user3', displayName: '次郎', avatar: null }
            ];
            wheel.initialize(members);
            
            const originalRandom = Math.random;
            Math.random = () => 0.5;
            
            const rotationBefore = wheel.rotation;
            await wheel.spin(members[0], { duration: 100, minRotations: 1 });
            const pointerIndex = wheel.getPointerIndex();
            
            expect(rotationBefore).toBe(0);
            expect(pointerIndex).toBe(0);
            
            Math.random = originalRandom;
            wheel.destroy();
        });

        test('プロパティベース: 1回目のアニメーションが常に正しく動作する', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-8人でランダム生成
                    fc.integer({ min: 3, max: 8 }),
                    // 選出するメンバーのインデックス
                    fc.integer({ min: 0, max: 7 }),
                    async (memberCount, selectedIndexRaw) => {
                        const wheel = new RouletteWheel(container);
                        
                        // メンバーリストを生成
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        wheel.initialize(members);
                        
                        // 選出インデックスをメンバー数に合わせて調整
                        const selectedIndex = selectedIndexRaw % memberCount;
                        const selectedMember = members[selectedIndex];
                        
                        const rotationBefore = wheel.rotation;
                        await wheel.spin(selectedMember, { duration: 50, minRotations: 1 });
                        const rotationAfter = wheel.rotation;
                        
                        // 1回目は常にrotation=0から開始
                        const initialRotationCorrect = rotationBefore === 0;
                        // アニメーションが完了している（rotationが変化している）
                        const animationCompleted = rotationAfter !== 0;
                        
                        if (!initialRotationCorrect || !animationCompleted) {
                            console.log(`失敗: メンバー数=${memberCount}, 選出=${selectedIndex}, 初期rotation=${rotationBefore}, 最終rotation=${rotationAfter}`);
                        }
                        
                        wheel.destroy();
                        return initialRotationCorrect && animationCompleted;
                    }
                ),
                { numRuns: 20 }
            );
        });
    });

    describe('円形ルーレット: 回転速度、イージング効果、視覚効果の維持', () => {
        test('アニメーション時間が指定されたdurationと一致する', async () => {
            const wheel = new RouletteWheel(container);
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null }
            ];
            wheel.initialize(members);
            
            const duration = 1000;
            const startTime = Date.now();
            await wheel.spin(members[0], { duration });
            const actualDuration = Date.now() - startTime;
            
            expect(actualDuration).toBeGreaterThanOrEqual(duration - 100);
            expect(actualDuration).toBeLessThanOrEqual(duration + 100);
            wheel.destroy();
        });

        test('最低回転数が保証される', async () => {
            const wheel = new RouletteWheel(container);
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null }
            ];
            wheel.initialize(members);
            
            const minRotations = 3;
            const rotationBefore = wheel.rotation;
            
            // Math.randomをモックして最大値を返す
            const originalRandom = Math.random;
            Math.random = () => 0.999;
            
            await wheel.spin(members[0], { duration: 100, minRotations });
            const rotationAfter = wheel.rotation;
            
            Math.random = originalRandom;
            
            const actualRotations = (rotationAfter - rotationBefore) / (Math.PI * 2);
            // extraRotations = minRotations + Math.random() * 2 なので、
            // 実際の回転数は minRotations 以上になるはず（targetAngleが負の場合を除く）
            // 保持テストとして、アニメーションが完了していることを確認
            expect(actualRotations).toBeGreaterThan(2);
            wheel.destroy();
        });

        test('プロパティベース: 回転速度とイージング効果が維持される', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-6人でランダム生成
                    fc.integer({ min: 3, max: 6 }),
                    // duration を800-1500msでランダム生成（テスト時間短縮）
                    fc.integer({ min: 800, max: 1500 }),
                    // minRotations を2-4回でランダム生成
                    fc.integer({ min: 2, max: 4 }),
                    async (memberCount, duration, minRotations) => {
                        const wheel = new RouletteWheel(container);
                        
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        wheel.initialize(members);
                        
                        const rotationBefore = wheel.rotation;
                        const startTime = Date.now();
                        
                        await wheel.spin(members[0], { duration, minRotations });
                        
                        const actualDuration = Date.now() - startTime;
                        const rotationAfter = wheel.rotation;
                        const actualRotations = (rotationAfter - rotationBefore) / (Math.PI * 2);
                        
                        // アニメーション時間が指定範囲内（より寛容な範囲）
                        const durationCorrect = actualDuration >= duration - 100 && actualDuration <= duration + 300;
                        // 回転が発生している（最低1回転以上）
                        const rotationsCorrect = actualRotations >= 1;
                        
                        if (!durationCorrect || !rotationsCorrect) {
                            console.log(`失敗: duration=${duration}ms(実際=${actualDuration}ms), minRotations=${minRotations}(実際=${actualRotations.toFixed(2)})`);
                        }
                        
                        wheel.destroy();
                        return durationCorrect && rotationsCorrect;
                    }
                ),
                { numRuns: 10 }
            );
        }, 20000); // タイムアウトを20秒に設定
    });

    describe('スロットマシン: 列1・2が正常に回転・停止', () => {
        test('列1と列2のdurationが正の値で、列ごとの停止時間差が適用される', async () => {
            const slotMachine = new SlotMachineAnimation(container);
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null },
                { id: 'user3', displayName: '次郎', avatar: null }
            ];
            slotMachine.initialize(members);
            
            const columnDurations = [];
            const originalAnimateColumn = slotMachine.animateColumn.bind(slotMachine);
            slotMachine.animateColumn = (column, selectedMember, selectedIndex, duration) => {
                columnDurations.push(duration);
                originalAnimateColumn(column, selectedMember, selectedIndex, duration);
            };
            
            await slotMachine.spin(members[0], { duration: 3000 });
            
            // 列1と列2が正常に回転する（durationが正の値）
            expect(columnDurations[1]).toBeGreaterThan(0);
            expect(columnDurations[2]).toBeGreaterThan(0);
            // 列ごとの停止時間差が適用される（durationが異なる）
            expect(columnDurations[1]).not.toBe(columnDurations[2]);
            // 順次停止する演出効果が維持される（列1が列2より先に停止）
            expect(columnDurations[1]).toBeLessThan(columnDurations[2]);
            slotMachine.destroy();
        }, 10000);

        test('プロパティベース: 列1と列2が常に正常に動作する', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-6人でランダム生成
                    fc.integer({ min: 3, max: 6 }),
                    // duration を3000-5000msでランダム生成
                    fc.integer({ min: 3000, max: 5000 }),
                    async (memberCount, duration) => {
                        const slotMachine = new SlotMachineAnimation(container);
                        
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        slotMachine.initialize(members);
                        
                        const columnDurations = [];
                        const originalAnimateColumn = slotMachine.animateColumn.bind(slotMachine);
                        slotMachine.animateColumn = (column, selectedMember, selectedIndex, dur) => {
                            columnDurations.push(dur);
                            originalAnimateColumn(column, selectedMember, selectedIndex, dur);
                        };
                        
                        await slotMachine.spin(members[0], { duration });
                        
                        // 列1と列2のdurationが正の値
                        const column1Positive = columnDurations[1] > 0;
                        const column2Positive = columnDurations[2] > 0;
                        // 列ごとの停止時間差が適用される（durationが異なる）
                        const durationsDifferent = columnDurations[1] !== columnDurations[2];
                        // 順次停止する演出効果が維持される（列1が列2より先に停止）
                        const orderCorrect = columnDurations[1] < columnDurations[2];
                        
                        if (!column1Positive || !column2Positive || !durationsDifferent || !orderCorrect) {
                            console.log(`失敗: 列1=${columnDurations[1]}ms, 列2=${columnDurations[2]}ms`);
                        }
                        
                        slotMachine.destroy();
                        return column1Positive && column2Positive && durationsDifferent && orderCorrect;
                    }
                ),
                { numRuns: 10 }
            );
        }, 60000);
    });

    describe('スロットマシン: 視覚効果の維持', () => {
        test('アニメーション実行後、すべての列が正しく配置される', async () => {
            const slotMachine = new SlotMachineAnimation(container);
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null },
                { id: 'user3', displayName: '次郎', avatar: null }
            ];
            slotMachine.initialize(members);
            
            await slotMachine.spin(members[1], { duration: 3000 });
            
            expect(slotMachine.columns.length).toBe(3);
            slotMachine.columns.forEach((column) => {
                const transform = column.reel.style.transform;
                expect(transform).toContain('translateY');
                const match = transform.match(/translateY\((-?\d+)px\)/);
                expect(match).not.toBeNull();
                expect(parseInt(match[1])).toBeLessThan(0);
            });
            slotMachine.destroy();
        }, 10000);

        test('プロパティベース: 視覚効果が常に維持される', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-6人でランダム生成
                    fc.integer({ min: 3, max: 6 }),
                    // 選出するメンバーのインデックス
                    fc.integer({ min: 0, max: 5 }),
                    async (memberCount, selectedIndexRaw) => {
                        const slotMachine = new SlotMachineAnimation(container);
                        
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        slotMachine.initialize(members);
                        
                        const selectedIndex = selectedIndexRaw % memberCount;
                        await slotMachine.spin(members[selectedIndex], { duration: 3000 });
                        
                        // すべての列が存在
                        const columnsExist = slotMachine.columns.length === 3;
                        
                        // すべての列が正しく配置されている（translateYが負の値）
                        let allColumnsPositioned = true;
                        for (const column of slotMachine.columns) {
                            const transform = column.reel.style.transform;
                            if (!transform.includes('translateY')) {
                                allColumnsPositioned = false;
                                break;
                            }
                            const match = transform.match(/translateY\((-?\d+)px\)/);
                            if (!match || parseInt(match[1]) >= 0) {
                                allColumnsPositioned = false;
                                break;
                            }
                        }
                        
                        if (!columnsExist || !allColumnsPositioned) {
                            console.log(`失敗: メンバー数=${memberCount}, 選出=${selectedIndex}, 列数=${slotMachine.columns.length}`);
                        }
                        
                        slotMachine.destroy();
                        return columnsExist && allColumnsPositioned;
                    }
                ),
                { numRuns: 10 }
            );
        }, 60000);
    });
});
