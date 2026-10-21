/**
 * animation-timing のユニットテスト
 */
import fc from 'fast-check';
import {
    easeOutCubic,
    buildDecelSchedule,
    pickOffsetInSection
} from '../../js/animations/animation-timing.js';

const intervalsOf = (times) => times.map((t, i) => (i === 0 ? t : t - times[i - 1]));

describe('easeOutCubic', () => {
    test('端点と中間値', () => {
        expect(easeOutCubic(0)).toBe(0);
        expect(easeOutCubic(1)).toBe(1);
        expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 10);
    });
});

describe('buildDecelSchedule(steps 省略)', () => {
    test('単調増加・間隔は単調非減少・最後が duration・間隔が許容範囲に入る', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3000, max: 10000 }),
                fc.integer({ min: 30, max: 100 }),
                fc.integer({ min: 200, max: 600 }),
                (duration, minInterval, maxInterval) => {
                    const times = buildDecelSchedule(duration, { minInterval, maxInterval });
                    expect(times.length).toBeGreaterThanOrEqual(1);
                    expect(Math.abs(times[times.length - 1] - duration)).toBeLessThanOrEqual(1);
                    const intervals = intervalsOf(times);
                    expect(times[0]).toBeGreaterThan(0);
                    for (let i = 1; i < times.length; i++) {
                        expect(times[i]).toBeGreaterThan(times[i - 1]);
                        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1] - 1e-9);
                    }
                    for (const v of intervals) {
                        expect(v).toBeGreaterThanOrEqual(minInterval * 0.5);
                        expect(v).toBeLessThanOrEqual(maxInterval * 1.5);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('ドラムロール・カードめくりの想定値で動く', () => {
        const drum = buildDecelSchedule(3000, { minInterval: 50, maxInterval: 400 });
        const card = buildDecelSchedule(3000, { minInterval: 60, maxInterval: 450 });
        expect(drum[drum.length - 1]).toBeCloseTo(3000, 6);
        expect(card[card.length - 1]).toBeCloseTo(3000, 6);
    });

    test('duration が極端に短くても 1 回以上の切り替えを返す', () => {
        const times = buildDecelSchedule(10, { minInterval: 50, maxInterval: 400 });
        expect(times).toHaveLength(1);
        expect(times[0]).toBe(10);
    });
});

describe('buildDecelSchedule(steps 指定)', () => {
    test('長さが steps、最後が duration、間隔が単調非減少', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 3000, max: 10000 }),
                fc.integer({ min: 1, max: 60 }),
                (duration, steps) => {
                    const times = buildDecelSchedule(duration, {
                        minInterval: 50,
                        maxInterval: 400,
                        steps
                    });
                    expect(times).toHaveLength(steps);
                    expect(Math.abs(times[steps - 1] - duration)).toBeLessThanOrEqual(1);
                    const intervals = intervalsOf(times);
                    for (let i = 1; i < steps; i++) {
                        expect(intervals[i]).toBeGreaterThanOrEqual(intervals[i - 1] - 1e-9);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    test('steps が 1 のとき最初の切り替えが duration', () => {
        expect(buildDecelSchedule(3000, { minInterval: 50, maxInterval: 400, steps: 1 })).toEqual([3000]);
    });
});

describe('pickOffsetInSection', () => {
    test('random が 0 / 0.999 のとき margin 以上 1 - margin 以下', () => {
        expect(pickOffsetInSection(() => 0, 0.15)).toBeCloseTo(0.15, 10);
        const high = pickOffsetInSection(() => 0.999, 0.15);
        expect(high).toBeGreaterThanOrEqual(0.15);
        expect(high).toBeLessThanOrEqual(0.85);
    });

    test('random が 0.5 のとき中央', () => {
        expect(pickOffsetInSection(() => 0.5, 0.15)).toBeCloseTo(0.5, 10);
    });

    test('任意の random と margin で範囲内(fast-check)', () => {
        fc.assert(
            fc.property(
                fc.double({ min: 0, max: 0.999, noNaN: true }),
                fc.double({ min: 0, max: 0.49, noNaN: true }),
                (r, margin) => {
                    const f = pickOffsetInSection(() => r, margin);
                    expect(f).toBeGreaterThanOrEqual(margin - 1e-12);
                    expect(f).toBeLessThanOrEqual(1 - margin + 1e-12);
                }
            ),
            { numRuns: 100 }
        );
    });
});
