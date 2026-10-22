/**
 * card-flip のユニットテスト
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import fc from 'fast-check';
import { CardFlipAnimation, buildHighlightSequence } from '../../js/animations/card-flip.js';

const makeMembers = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `m${i}`, displayName: `Member${i}`, avatar: null }));

const setup = (n) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const animation = new CardFlipAnimation(container);
    const members = makeMembers(n);
    animation.initialize(members);
    return { container, animation, members };
};

const cardEls = (container) => Array.from(container.querySelectorAll('.card-flip-item'));

/**
 * spin を走らせ、仮想時間を進めて終了まで待つ。
 * 同期の advanceTimersByTime で進める。jsdom では Async 版が偽タイマー1件ごとに
 * 本物の setTimeout で待つので、環境しだいで遅くなる。spin はタイマーをすべて同期に
 * 予約し途中に await が無いため、同期で最後まで進む
 */
const runSpin = async (animation, member, duration) => {
    const promise = animation.spin(member, { duration });
    jest.advanceTimersByTime(duration + 1100);
    await promise;
};

describe('CardFlipAnimation', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('初期状態で全カードが裏向きで、表と裏の2面がある', () => {
        const { container } = setup(6);
        const cards = cardEls(container);
        expect(cards).toHaveLength(6);
        cards.forEach(el => {
            expect(el.classList.contains('card-flip-flipped')).toBe(false);
            expect(el.classList.contains('card-flip-highlight')).toBe(false);
            expect(el.querySelector('.card-flip-front .card-flip-name')).not.toBeNull();
            expect(el.querySelector('.card-flip-back')).not.toBeNull();
            expect(el.querySelector('.card-flip-back .card-flip-name')).toBeNull();
        });
    });

    describe('buildHighlightSequence', () => {
        test('最後が当選カード、連続で同じカードが光らず、最後から2番目は当選カード以外', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 2, max: 30 }),
                    fc.integer({ min: 1, max: 80 }),
                    fc.double({ min: 0, max: 0.999999, noNaN: true }),
                    fc.nat(),
                    (n, steps, seed, w) => {
                        const winner = w % n;
                        let s = seed;
                        const random = () => {
                            s = (s * 9301 + 0.49297) % 1;
                            return s;
                        };
                        const seq = buildHighlightSequence(n, winner, steps, random);
                        expect(seq).toHaveLength(steps);
                        expect(seq[steps - 1]).toBe(winner);
                        for (let j = 1; j < steps; j++) {
                            expect(seq[j]).not.toBe(seq[j - 1]);
                        }
                        seq.forEach(i => {
                            expect(i).toBeGreaterThanOrEqual(0);
                            expect(i).toBeLessThan(n);
                        });
                    }
                ),
                { numRuns: 50 }
            );
        });

        test('random が 0 / 0.999 でも範囲内で直前と重ならない', () => {
            [0, 0.999].forEach(v => {
                const seq = buildHighlightSequence(5, 2, 20, () => v);
                expect(seq[19]).toBe(2);
                for (let j = 1; j < seq.length; j++) {
                    expect(seq[j]).not.toBe(seq[j - 1]);
                    expect(seq[j]).toBeLessThan(5);
                }
            });
        });

        test('1枚だけのときは同じカードが続く', () => {
            expect(buildHighlightSequence(1, 0, 4)).toEqual([0, 0, 0, 0]);
        });
    });

    test('spin の光る順番の最後が当選カードで、連続しない', async () => {
        const { animation, members } = setup(8);
        await runSpin(animation, members[3], 3000);
        const seq = animation.lastHighlightSequence;
        expect(seq[seq.length - 1]).toBe(3);
        for (let j = 1; j < seq.length; j++) {
            expect(seq[j]).not.toBe(seq[j - 1]);
        }
    });

    test('光が移動するたびに光るカードが1枚だけになる', async () => {
        const { container, animation, members } = setup(5);
        const promise = animation.spin(members[2], { duration: 2000 });
        jest.advanceTimersByTime(1000);
        expect(container.querySelectorAll('.card-flip-highlight')).toHaveLength(1);
        jest.advanceTimersByTime(2100);
        await promise;
    });

    test('duration 直後は光が当選カードだけに付き、めくりは duration より後', async () => {
        for (let k = 0; k < 10; k++) {
            document.body.innerHTML = '';
            const { container, animation, members } = setup(5);
            const promise = animation.spin(members[2], { duration: 2000 });
            jest.advanceTimersByTime(2001);
            const cards = cardEls(container);
            cards.forEach((el, i) => {
                expect(el.classList.contains('card-flip-highlight')).toBe(i === 2);
                expect(el.classList.contains('card-flip-flipped')).toBe(false);
            });
            // 約 400ms 光ったまま見える
            jest.advanceTimersByTime(300);
            expect(cards[2].classList.contains('card-flip-highlight')).toBe(true);
            expect(cards[2].classList.contains('card-flip-flipped')).toBe(false);
            jest.advanceTimersByTime(100);
            expect(cards[2].classList.contains('card-flip-flipped')).toBe(true);
            expect(cards[2].classList.contains('card-flip-selected')).toBe(true);
            expect(container.querySelectorAll('.card-flip-highlight')).toHaveLength(0);
            // 残りはさらに 300ms 後
            expect(cards[0].classList.contains('card-flip-flipped')).toBe(false);
            jest.advanceTimersByTime(300);
            expect(cards[0].classList.contains('card-flip-flipped')).toBe(true);
            jest.advanceTimersByTime(1100);
            await promise;
        }
    });

    test('spin 後、当選カードは card-flip-selected、他は card-flip-unselected でめくれている', async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 30 }), fc.nat(), async (n, w) => {
                document.body.innerHTML = '';
                const { container, animation, members } = setup(n);
                const winner = w % n;
                await runSpin(animation, members[winner], 500);
                cardEls(container).forEach((el, i) => {
                    expect(el.classList.contains('card-flip-flipped')).toBe(true);
                    expect(el.classList.contains('card-flip-selected')).toBe(i === winner);
                    expect(el.classList.contains('card-flip-unselected')).toBe(i !== winner);
                    expect(el.classList.contains('card-flip-highlight')).toBe(false);
                });
                expect(animation.isSpinning).toBe(false);
            }),
            { numRuns: 15 }
        );
    }, 30000);

    test('spin の Promise は確定後の演出(合計約1秒)のあとに resolve する', async () => {
        const { animation, members } = setup(4);
        let done = false;
        animation.spin(members[0], { duration: 1000 }).then(() => { done = true; });
        jest.advanceTimersByTime(1000 + 900);
        await Promise.resolve();
        expect(done).toBe(false);
        jest.advanceTimersByTime(200);
        await Promise.resolve();
        expect(done).toBe(true);
    });

    test('2回目の spin 開始時に前回の状態が残らない', async () => {
        const { container, animation, members } = setup(4);
        await runSpin(animation, members[1], 500);
        const promise = animation.spin(members[2], { duration: 500 });
        cardEls(container).forEach(el => {
            expect(el.classList.contains('card-flip-flipped')).toBe(false);
            expect(el.classList.contains('card-flip-selected')).toBe(false);
            expect(el.classList.contains('card-flip-unselected')).toBe(false);
        });
        jest.advanceTimersByTime(2000);
        await promise;
        expect(cardEls(container)[2].classList.contains('card-flip-selected')).toBe(true);
    });

    test('updateMembers 後、カードは残りの人数で、すべて裏向き・強調なし', async () => {
        const { container, animation, members } = setup(5);
        await runSpin(animation, members[0], 500);
        animation.updateMembers(members.slice(1));
        const cards = cardEls(container);
        expect(cards).toHaveLength(4);
        expect(container.querySelector('[data-member-id="m0"]')).toBeNull();
        cards.forEach(el => {
            ['card-flip-flipped', 'card-flip-highlight', 'card-flip-selected', 'card-flip-unselected']
                .forEach(c => expect(el.classList.contains(c)).toBe(false));
        });
        await runSpin(animation, members[2], 500);
        expect(container.querySelector('[data-member-id="m2"]').classList.contains('card-flip-selected')).toBe(true);
    });

    test('1人だけでも光の移動を省かず、最後にめくれる', async () => {
        const { container, animation, members } = setup(1);
        const promise = animation.spin(members[0], { duration: 1000 });
        jest.advanceTimersByTime(500);
        expect(animation.lastHighlightSequence.length).toBeGreaterThan(1);
        jest.advanceTimersByTime(2000);
        await promise;
        expect(cardEls(container)[0].classList.contains('card-flip-selected')).toBe(true);
    });

    test('destroy 後にタイマーが走らず、待っている spin は resolve する', async () => {
        const { container, animation, members } = setup(4);
        let done = false;
        animation.spin(members[0], { duration: 2000 }).then(() => { done = true; });
        jest.advanceTimersByTime(500);
        animation.destroy();
        expect(jest.getTimerCount()).toBe(0);
        await Promise.resolve();
        expect(done).toBe(true);
        jest.advanceTimersByTime(5000);
        expect(container.innerHTML).toBe('');
    });

    test('当選者が members にいないと reject され、isSpinning は立たない', async () => {
        const { animation } = setup(4);
        await expect(animation.spin({ id: 'unknown', displayName: 'X' }, { duration: 1000 }))
            .rejects.toThrow('選出されたメンバーがカードに存在しません');
        expect(animation.isSpinning).toBe(false);
    });
});
