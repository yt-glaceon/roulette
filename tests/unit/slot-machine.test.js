/**
 * slot-machine のユニットテスト
 * 純粋関数 planReelMotion / reelPositionAt と、実時間の spin を検証する
 * (旧 animation-bug-exploration / animation-preservation のスロット部分の移し先)
 */
import { jest } from '@jest/globals';
import fc from 'fast-check';
import {
    SlotMachineAnimation,
    planReelMotion,
    reelPositionAt
} from '../../js/animations/slot-machine.js';

const BASE_SPEED = 15 / 1000; // アイテム/ms
const RATIOS = [0.6, 0.8, 1.0];

const mod = (a, n) => ((a % n) + n) % n;

const makeMembers = (count) =>
    Array.from({ length: count }, (_, i) => ({
        id: `user${i}`,
        displayName: `User${i}`,
        avatar: null
    }));

const planFor = ({ pos0, n, winnerIndex, stopTime }) =>
    planReelMotion({ pos0, n, winnerIndex, stopTime, baseSpeed: BASE_SPEED });

const planArb = fc.record({
    n: fc.integer({ min: 1, max: 30 }),
    pos0: fc.integer({ min: 0, max: 200 }),
    winnerRaw: fc.integer({ min: 0, max: 29 }),
    duration: fc.integer({ min: 3000, max: 10000 }),
    k: fc.integer({ min: 0, max: 2 })
});

const buildPlan = ({ n, pos0, winnerRaw, duration, k }) => {
    const winnerIndex = winnerRaw % n;
    const stopTime = duration * RATIOS[k];
    return { winnerIndex, stopTime, plan: planFor({ pos0, n, winnerIndex, stopTime }) };
};

describe('planReelMotion / reelPositionAt', () => {
    test('T で pos0 + S に一致し、当選者が中央に来る', () => {
        fc.assert(
            fc.property(planArb, (arg) => {
                const { winnerIndex, stopTime, plan } = buildPlan(arg);
                const end = reelPositionAt(plan, stopTime);
                expect(end).toBe(plan.pos0 + plan.S);
                expect(Number.isInteger(plan.S)).toBe(true);
                expect(mod(-(plan.pos0 + plan.S), arg.n)).toBe(winnerIndex);
            }),
            { numRuns: 200 }
        );
    });

    test('時刻とともに pos は単調非減少(上から下へ流れる向き)', () => {
        fc.assert(
            fc.property(planArb, (arg) => {
                const { stopTime, plan } = buildPlan(arg);
                let prev = reelPositionAt(plan, 0);
                expect(prev).toBe(plan.pos0);
                for (let i = 1; i <= 300; i++) {
                    const cur = reelPositionAt(plan, (stopTime * i) / 300);
                    expect(cur).toBeGreaterThanOrEqual(prev - 1e-9);
                    prev = cur;
                }
            }),
            { numRuns: 100 }
        );
    });

    test('定速区間では速度が V で一定、減速区間では速度が単調に下がり T で 0', () => {
        fc.assert(
            fc.property(planArb, (arg) => {
                const { plan } = buildPlan(arg);
                const { V, r, D, T } = plan;
                const dt = 1;
                const speedAt = (t) => (reelPositionAt(plan, t + dt) - reelPositionAt(plan, t)) / dt;

                // 定速区間
                const constStart = r;
                const constEnd = T - D;
                for (let i = 0; i <= 10; i++) {
                    const t = constStart + ((constEnd - constStart - dt) * i) / 10;
                    expect(speedAt(t)).toBeCloseTo(V, 6);
                }

                // 減速区間: 速度は単調非増加で、終端で 0 に近づく
                let prev = Infinity;
                for (let i = 0; i < 50; i++) {
                    const t = constEnd + ((D - dt) * i) / 50;
                    const s = speedAt(t);
                    expect(s).toBeLessThanOrEqual(prev + 1e-9);
                    prev = s;
                }
                // 減速開始直後は V に一致、終端直前はほぼ 0
                expect(speedAt(constEnd)).toBeGreaterThan(V * 0.98);
                expect(speedAt(T - dt)).toBeLessThan(V * 1e-3 + 1e-9);
                // 停止後は動かない
                expect(reelPositionAt(plan, T + 500)).toBe(plan.pos0 + plan.S);
            }),
            { numRuns: 100 }
        );
    });

    test('S >= S0 かつ V <= V0 + n / K', () => {
        fc.assert(
            fc.property(planArb, (arg) => {
                const { plan } = buildPlan(arg);
                const { r, D, T, S, V } = plan;
                const K = r / 2 + (T - D - r) + D / 3;
                expect(S).toBeGreaterThanOrEqual(BASE_SPEED * K - 1e-9);
                expect(V).toBeGreaterThanOrEqual(BASE_SPEED - 1e-12);
                expect(V).toBeLessThanOrEqual(BASE_SPEED + arg.n / K + 1e-12);
                expect(S).toBeCloseTo(V * K, 6);
            }),
            { numRuns: 200 }
        );
    });

    test('人数1人でも S = ceil(S0) で動く', () => {
        const plan = planFor({ pos0: 0, n: 1, winnerIndex: 0, stopTime: 5000 });
        const { r, D, T } = plan;
        const K = r / 2 + (T - D - r) + D / 3;
        expect(plan.S).toBe(Math.ceil(BASE_SPEED * K));
    });

    test('列の停止時刻が duration の 60% / 80% / 100% で、左から順に止まる', async () => {
        const members = makeMembers(5);
        const container = document.createElement('div');
        document.body.appendChild(container);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);
        const duration = 5000;
        const plans = slot.columns.map((column, k) =>
            planFor({
                pos0: column.pos,
                n: column.order.length,
                winnerIndex: 0,
                stopTime: duration * RATIOS[k]
            })
        );
        expect(plans.map((p) => p.T)).toEqual([3000, 4000, 5000]);
        expect(plans[0].T).toBeLessThan(plans[1].T);
        expect(plans[1].T).toBeLessThan(plans[2].T);
        // 停止時刻より前は動いており、停止時刻以降は止まっている
        plans.forEach((p) => {
            expect(reelPositionAt(p, p.T - 50)).toBeLessThan(p.pos0 + p.S);
            expect(reelPositionAt(p, p.T)).toBe(p.pos0 + p.S);
        });
        slot.destroy();
        container.remove();
    });
});

describe('SlotMachineAnimation(実時間の spin)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    /** DOM の transform から各列の中央行のメンバー名を求める */
    const centerNamesFromDom = (slot) =>
        slot.columns.map((column) => {
            const match = column.reel.style.transform.match(/translateY\((-?[\d.]+)px\)/);
            expect(match).not.toBeNull();
            const row = Math.round(-parseFloat(match[1]) / slot.itemHeight + 1);
            const items = column.reel.querySelectorAll('.slot-item');
            return items[row].querySelector('.slot-name').textContent;
        });

    test('3列すべての中央が当選者になる(getCenterMember と DOM の両方)', () => {
        return fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 30 }),
                fc.integer({ min: 0, max: 29 }),
                fc.integer({ min: 20, max: 300 }),
                async (count, winnerRaw, duration) => {
                    const members = makeMembers(count);
                    const winner = members[winnerRaw % count];
                    const slot = new SlotMachineAnimation(container);
                    slot.initialize(members);

                    await slot.spin(winner, { duration });

                    expect(slot.columns.length).toBe(3);
                    for (let k = 0; k < 3; k++) {
                        expect(slot.getCenterMember(k).id).toBe(winner.id);
                    }
                    centerNamesFromDom(slot).forEach((name) => {
                        expect(name).toBe(winner.displayName);
                    });
                    slot.destroy();
                }
            ),
            { numRuns: 15 }
        );
    }, 30000);

    test('停止後、すべての列に translateY が反映されている', async () => {
        const members = makeMembers(3);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);

        await slot.spin(members[1], { duration: 100 });

        slot.columns.forEach((column) => {
            expect(column.reel.style.transform).toMatch(/^translateY\(-?[\d.]+px\)$/);
        });
        slot.destroy();
    });

    test('リールの DOM は order を R 回繰り返す(R = 2 + ceil(3 / n))', () => {
        [1, 2, 3, 10].forEach((n) => {
            const slot = new SlotMachineAnimation(container);
            slot.initialize(makeMembers(n));
            const R = 2 + Math.ceil(3 / n);
            slot.columns.forEach((column) => {
                expect(column.reel.querySelectorAll('.slot-item').length).toBe(R * n);
            });
            slot.destroy();
        });
    });

    test('2回目の spin 開始時の pos は1回目終了時の pos と同じ(0 に戻らない)', async () => {
        const members = makeMembers(8);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);

        await slot.spin(members[3], { duration: 100 });
        const afterFirst = slot.columns.map((c) => c.pos);
        expect(afterFirst.every((p) => p > 0)).toBe(true);

        const startPositions = [];
        const second = slot.spin(members[5], { duration: 100 });
        // spin 開始直後(最初のフレーム前)の pos
        slot.columns.forEach((c) => startPositions.push(c.pos));
        await second;

        expect(startPositions).toEqual(afterFirst);
        for (let k = 0; k < 3; k++) {
            expect(slot.getCenterMember(k).id).toBe(members[5].id);
        }
        slot.destroy();
    });

    test('updateMembers 後の spin で当選者が中央に来て、外したメンバーはリールに無い', async () => {
        const members = makeMembers(6);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);

        await slot.spin(members[2], { duration: 100 });

        const remaining = members.filter((m) => m.id !== members[2].id);
        slot.updateMembers(remaining);

        slot.columns.forEach((column) => {
            const names = Array.from(column.reel.querySelectorAll('.slot-name')).map(
                (el) => el.textContent
            );
            expect(names).not.toContain(members[2].displayName);
            expect(column.order.length).toBe(5);
            expect(column.pos).toBe(mod(column.pos, 5));
        });

        await slot.spin(remaining[3], { duration: 100 });
        for (let k = 0; k < 3; k++) {
            expect(slot.getCenterMember(k).id).toBe(remaining[3].id);
        }
        centerNamesFromDom(slot).forEach((name) => {
            expect(name).toBe(remaining[3].displayName);
        });
        slot.destroy();
    });

    test('当選者が盤面にいなければ spin はエラーにする', async () => {
        const members = makeMembers(3);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);
        await expect(slot.spin({ id: 'nobody', displayName: 'x' }, { duration: 50 })).rejects.toThrow();
        expect(slot.isSpinning).toBe(false);
        slot.destroy();
    });

    test('destroy 後に rAF のコールバックで DOM が更新されない', async () => {
        const members = makeMembers(5);
        const slot = new SlotMachineAnimation(container);
        slot.initialize(members);
        const reel = slot.columns[0].reel;

        const pending = new Map();
        let nextId = 1;
        const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
            pending.set(nextId, cb);
            return nextId++;
        });
        const cancelSpy = jest
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation((id) => pending.delete(id));

        const spinPromise = slot.spin(members[1], { duration: 1000 });
        expect(pending.size).toBe(1);
        const leftover = Array.from(pending.values());

        slot.destroy();
        await spinPromise; // destroy で resolve される

        expect(cancelSpy).toHaveBeenCalled();
        expect(pending.size).toBe(0);

        const before = reel.style.transform;
        leftover.forEach((cb) => cb());
        expect(reel.style.transform).toBe(before);
        expect(pending.size).toBe(0);
        expect(container.innerHTML).toBe('');

        cancelSpy.mockRestore();
        rafSpy.mockRestore();
    });
});
