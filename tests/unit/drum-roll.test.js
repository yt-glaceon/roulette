/**
 * DrumRollAnimation のユニットテスト
 */
import { jest } from '@jest/globals';
import fc from 'fast-check';
import { DrumRollAnimation } from '../../js/animations/drum-roll.js';

const makeMembers = (n) =>
    Array.from({ length: n }, (_, i) => ({
        id: `id-${i}`,
        displayName: `Member${i}`,
        avatar: null
    }));

const displayedName = (container) =>
    container.querySelector('.drum-roll-name')?.textContent;

describe('DrumRollAnimation', () => {
    let container;
    let drum;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        drum = new DrumRollAnimation(container);
    });

    afterEach(() => {
        jest.useRealTimers();
        drum.destroy();
        container.remove();
    });

    // 表示された順に { name, time } を記録する
    const recordShown = () => {
        const shown = [];
        const original = drum.showMember.bind(drum);
        drum.showMember = (member) => {
            shown.push({ name: member.displayName, time: Date.now() });
            original(member);
        };
        return shown;
    };

    // fake timers 上で spin を最後まで進める
    const runSpin = async (winner, duration) => {
        const promise = drum.spin(winner, { duration });
        await jest.advanceTimersByTimeAsync(duration + 2000);
        await promise;
    };

    test('spin 後の表示が当選者(人数 1〜30、実時間)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 30 }),
                fc.nat(29),
                fc.nat(29),
                async (count, winnerSeed, startSeed) => {
                    const members = makeMembers(count);
                    drum.initialize(members);
                    drum.currentIndex = startSeed % count;
                    const winner = members[winnerSeed % count];
                    await drum.spin(winner, { duration: 150 });
                    expect(displayedName(container)).toBe(winner.displayName);
                }
            ),
            { numRuns: 10 }
        );
    }, 30000);

    test('最後の切り替えの直前は当選者ではなく、1人ずつ進む(人数2以上、開始=当選者の場合を含む)', async () => {
        jest.useFakeTimers();
        for (const count of [2, 3, 8, 30]) {
            for (const startIndex of [0, count - 1]) {
                for (const winnerIndex of [0, 1, count - 1]) {
                    const members = makeMembers(count);
                    drum.initialize(members);
                    drum.currentIndex = startIndex;
                    const shown = recordShown();
                    await runSpin(members[winnerIndex], 3000);

                    const names = shown.map((s) => s.name);
                    // 先頭は開始時に表示し直した人
                    expect(names[0]).toBe(members[startIndex].displayName);
                    for (let i = 1; i < names.length; i++) {
                        const prev = members.findIndex((m) => m.displayName === names[i - 1]);
                        expect(names[i]).toBe(members[(prev + 1) % count].displayName);
                    }
                    expect(names[names.length - 1]).toBe(members[winnerIndex].displayName);
                    expect(names[names.length - 2]).not.toBe(members[winnerIndex].displayName);
                    drum.destroy();
                }
            }
        }
    });

    test('N が人数の倍数になる場合(開始=当選者)でも最後の切り替えで当選者になる', async () => {
        jest.useFakeTimers();
        const members = makeMembers(2);
        drum.initialize(members);
        drum.currentIndex = 1;
        const shown = recordShown();
        await runSpin(members[1], 3000);
        const names = shown.map((s) => s.name);
        expect(names[0]).toBe('Member1');
        expect(names[names.length - 1]).toBe('Member1');
        expect(names[names.length - 2]).toBe('Member0');
    });

    test('1人だけでも最後に当選者が表示される', async () => {
        jest.useFakeTimers();
        const members = makeMembers(1);
        drum.initialize(members);
        await runSpin(members[0], 1000);
        expect(displayedName(container)).toBe('Member0');
    });

    test('人数30・duration 3000 でも最短間隔が 20ms 以上、最後の切り替えが duration 付近', async () => {
        jest.useFakeTimers();
        for (const winnerIndex of [0, 7, 15, 29]) {
            const members = makeMembers(30);
            drum.initialize(members);
            const shown = recordShown();
            const start = Date.now();
            await runSpin(members[winnerIndex], 3000);

            // shown[0] は開始時の再表示。以降が切り替え
            const switches = shown.slice(1).map((s) => s.time - start);
            for (let i = 1; i < switches.length; i++) {
                expect(switches[i] - switches[i - 1]).toBeGreaterThanOrEqual(20);
            }
            expect(switches[0]).toBeGreaterThanOrEqual(20);
            expect(Math.abs(switches[switches.length - 1] - 3000)).toBeLessThanOrEqual(100);
            drum.destroy();
        }
    });

    test('updateMembers: 表示中の人が残っていればそのインデックスに移る', () => {
        const members = makeMembers(5);
        drum.initialize(members);
        drum.currentIndex = 3;
        drum.updateMembers(members.filter((m) => m.id !== 'id-1'));
        expect(drum.currentIndex).toBe(2);
    });

    test('updateMembers: 表示中の人が外れたとき currentIndex が範囲内に収まり、次の spin で当選者が表示される', async () => {
        jest.useFakeTimers();
        const members = makeMembers(5);
        drum.initialize(members);
        drum.currentIndex = 4;
        const remaining = members.slice(0, 4);
        drum.updateMembers(remaining);
        expect(drum.currentIndex).toBe(3);
        expect(drum.currentIndex).toBeLessThan(remaining.length);

        await runSpin(remaining[1], 2000);
        expect(displayedName(container)).toBe('Member1');
    });

    test('destroy 後にタイマーが走らず、待っている spin は resolve する', async () => {
        jest.useFakeTimers();
        const members = makeMembers(5);
        drum.initialize(members);
        const promise = drum.spin(members[2], { duration: 3000 });
        await jest.advanceTimersByTimeAsync(500);
        expect(jest.getTimerCount()).toBeGreaterThan(0);

        drum.destroy();
        expect(jest.getTimerCount()).toBe(0);
        await expect(promise).resolves.toBeUndefined();
    });
});
