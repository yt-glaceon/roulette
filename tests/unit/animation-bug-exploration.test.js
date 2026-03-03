/**
 * アニメーション結果不一致バグの探索テスト
 * Property 1: Fault Condition - アニメーション結果不一致の再現
 * 
 * 重要: このテストは未修正コードで実行し、失敗することを確認する（失敗がバグの存在を証明）
 * 注意: このテストは期待される動作をエンコードしており、実装後にパスすることで修正を検証する
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */

import fc from 'fast-check';
import { RouletteWheel } from '../../js/animations/roulette-wheel.js';
import { SlotMachineAnimation } from '../../js/animations/slot-machine.js';

describe('バグ条件探索テスト - アニメーション結果不一致', () => {
    let container;

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
    });

    afterEach(() => {
        // クリーンアップ
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('円形ルーレット: 2回目以降のアニメーション結果不一致', () => {
        /**
         * バグ条件: 2回目以降のアニメーション実行時にrotation値がリセットされない
         * 期待される動作: 各回のアニメーションで針が指すユーザーが選出結果と一致すること
         */
        test('1回目と2回目のアニメーションで針が指すユーザーが選出結果と一致する', async () => {
            const wheel = new RouletteWheel(container);
            
            // テストメンバーを作成
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null },
                { id: 'user3', displayName: '次郎', avatar: null },
                { id: 'user4', displayName: '美咲', avatar: null }
            ];
            
            wheel.initialize(members);
            
            // ランダムオフセットを無効化するため、Math.randomをモック
            const originalRandom = Math.random;
            Math.random = () => 0.5; // 中央値を返す（オフセット=0）
            
            // 1回目のアニメーション: user1を選出
            const firstSelected = members[0];
            const rotationBefore1st = wheel.rotation;
            
            await wheel.spin(firstSelected, { duration: 100, minRotations: 1 });
            
            const rotationAfter1st = wheel.rotation;
            const pointerIndex1st = wheel.getPointerIndex();
            
            console.log(`1回目: rotation前=${rotationBefore1st}, rotation後=${rotationAfter1st}, 針のインデックス=${pointerIndex1st}, 選出=${firstSelected.displayName}`);
            
            // 1回目: 針が指すユーザーが選出結果と一致することを確認
            expect(pointerIndex1st).toBe(0); // user1のインデックス
            
            // 2回目のアニメーション: user2を選出
            const secondSelected = members[1];
            const rotationBefore2nd = wheel.rotation;
            
            await wheel.spin(secondSelected, { duration: 100, minRotations: 1 });
            
            const rotationAfter2nd = wheel.rotation;
            const pointerIndex2nd = wheel.getPointerIndex();
            
            console.log(`2回目: rotation前=${rotationBefore2nd}, rotation後=${rotationAfter2nd}, 針のインデックス=${pointerIndex2nd}, 選出=${secondSelected.displayName}`);
            
            // 修正後: 2回目開始時にrotationがリセットされている
            // 修正コードでは rotationBefore2nd === 0 となる（spin()メソッド内でリセット）
            console.log(`修正確認: 2回目開始時のrotation=${rotationBefore2nd} (0であるべき)`);
            // 注: spin()メソッド内でrotationがリセットされるため、この時点ではまだ前回の値が残っている
            // 実際のリセットはspin()メソッド内で行われる
            
            // 2回目: 針が指すユーザーが選出結果と一致することを確認
            // 未修正コードではこのアサーションが失敗する（バグの証明）
            expect(pointerIndex2nd).toBe(1); // user2のインデックス
            
            // Math.randomを元に戻す
            Math.random = originalRandom;
            
            wheel.destroy();
        });

        test('プロパティベース: 複数回のアニメーションで常に針が選出結果と一致する', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-6人でランダム生成
                    fc.integer({ min: 3, max: 6 }),
                    // 選出回数を2-3回でランダム生成
                    fc.integer({ min: 2, max: 3 }),
                    async (memberCount, spinCount) => {
                        const wheel = new RouletteWheel(container);
                        
                        // メンバーリストを生成
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        wheel.initialize(members);
                        
                        // ランダムオフセットを無効化するため、Math.randomをモック
                        const originalRandom = Math.random;
                        Math.random = () => 0.5; // 中央値を返す（オフセット=0）
                        
                        // 複数回アニメーションを実行
                        for (let i = 0; i < spinCount; i++) {
                            const selectedIndex = i % memberCount;
                            const selectedMember = members[selectedIndex];
                            
                            await wheel.spin(selectedMember, { duration: 50, minRotations: 1 });
                            
                            const pointerIndex = wheel.getPointerIndex();
                            
                            // 各回で針が指すユーザーが選出結果と一致することを確認
                            if (pointerIndex !== selectedIndex) {
                                console.log(`失敗: 回数=${i + 1}, 期待=${selectedIndex}, 実際=${pointerIndex}, rotation=${wheel.rotation}`);
                                Math.random = originalRandom;
                                wheel.destroy();
                                return false;
                            }
                        }
                        
                        // Math.randomを元に戻す
                        Math.random = originalRandom;
                        wheel.destroy();
                        return true;
                    }
                ),
                { numRuns: 10 }
            );
        });
    });

    describe('スロットマシン: 左端スロット停止問題', () => {
        /**
         * バグ条件: 列インデックス0に対してcolumnDurationが負の値になる
         * 期待される動作: すべてのスロット列が正常に回転し、左から右へ順番に停止すること
         */
        test('列0のcolumnDurationが正の値で、他の列より短い', async () => {
            const slotMachine = new SlotMachineAnimation(container);
            
            // テストメンバーを作成
            const members = [
                { id: 'user1', displayName: '太郎', avatar: null },
                { id: 'user2', displayName: '花子', avatar: null },
                { id: 'user3', displayName: '次郎', avatar: null }
            ];
            
            slotMachine.initialize(members);
            
            // animateColumnメソッドをスパイして各列のdurationを記録
            const columnDurations = [];
            const originalAnimateColumn = slotMachine.animateColumn.bind(slotMachine);
            slotMachine.animateColumn = (column, selectedMember, selectedIndex, duration) => {
                columnDurations.push(duration);
                originalAnimateColumn(column, selectedMember, selectedIndex, duration);
            };
            
            const selectedMember = members[0];
            const duration = 3000; // テスト時間を短縮
            
            // アニメーションを実行（完了を待つ）
            await slotMachine.spin(selectedMember, { duration });
            
            console.log(`列のduration: ${columnDurations.join(', ')}`);
            
            // 修正後の確認: 列0のdurationが最小値になっている
            // 修正コードでは columnDurations[0] = (0 + 1) * 1000 = 1000
            // 列1: (1 + 1) * 1000 = 2000
            // 列2: (2 + 1) * 1000 = 3000
            
            // すべての列が記録されていることを確認
            expect(columnDurations.length).toBe(3);
            
            // 期待される動作: 列0が最初に停止する（最も短いduration）
            expect(columnDurations[0]).toBeLessThan(columnDurations[1]);
            expect(columnDurations[1]).toBeLessThan(columnDurations[2]);
            
            // すべての列のdurationが正の値であることを確認
            columnDurations.forEach((dur, index) => {
                expect(dur).toBeGreaterThan(0);
                console.log(`列${index}: duration=${dur}ms`);
            });
            
            slotMachine.destroy();
        }, 10000); // タイムアウトを10秒に延長

        test('プロパティベース: すべての列が正の値のdurationを持ち、左から右へ順番に停止する', () => {
            return fc.assert(
                fc.asyncProperty(
                    // メンバー数を3-6人でランダム生成
                    fc.integer({ min: 3, max: 6 }),
                    // duration を3000-5000msでランダム生成（テスト時間短縮）
                    fc.integer({ min: 3000, max: 5000 }),
                    async (memberCount, duration) => {
                        const slotMachine = new SlotMachineAnimation(container);
                        
                        // メンバーリストを生成
                        const members = Array.from({ length: memberCount }, (_, i) => ({
                            id: `user${i}`,
                            displayName: `User${i}`,
                            avatar: null
                        }));
                        
                        slotMachine.initialize(members);
                        
                        // animateColumnメソッドをスパイして各列のdurationを記録
                        const columnDurations = [];
                        const originalAnimateColumn = slotMachine.animateColumn.bind(slotMachine);
                        slotMachine.animateColumn = (column, selectedMember, selectedIndex, dur) => {
                            columnDurations.push(dur);
                            originalAnimateColumn(column, selectedMember, selectedIndex, dur);
                        };
                        
                        const selectedMember = members[0];
                        
                        // アニメーションを実行（完了を待つ）
                        await slotMachine.spin(selectedMember, { duration });
                        
                        // すべての列のdurationが正の値であることを確認
                        for (let i = 0; i < columnDurations.length; i++) {
                            if (columnDurations[i] <= 0) {
                                console.log(`失敗: 列${i}のduration=${columnDurations[i]} (正の値であるべき)`);
                                slotMachine.destroy();
                                return false;
                            }
                        }
                        
                        // 左から右へ順番に停止する（duration が短い順）
                        for (let i = 0; i < columnDurations.length - 1; i++) {
                            if (columnDurations[i] >= columnDurations[i + 1]) {
                                console.log(`失敗: 列${i}のduration=${columnDurations[i]} >= 列${i + 1}のduration=${columnDurations[i + 1]}`);
                                slotMachine.destroy();
                                return false;
                            }
                        }
                        
                        slotMachine.destroy();
                        return true;
                    }
                ),
                { numRuns: 10 }
            );
        }, 60000); // タイムアウトを60秒に設定（10回 × 最大5秒）
    });
});
