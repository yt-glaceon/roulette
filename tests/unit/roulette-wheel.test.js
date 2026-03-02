/**
 * RouletteWheel のユニットテスト
 */
import { RouletteWheel } from '../../js/roulette-wheel.js';

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
});
