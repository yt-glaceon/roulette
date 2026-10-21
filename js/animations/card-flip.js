import { buildDecelSchedule } from './animation-timing.js';

/** 当選カードをめくり始めてから残りをめくるまでの時間(ms) */
const OTHERS_FLIP_DELAY = 300;
/** 残りをめくり始めてから resolve するまでの時間(ms)。合計で約 1 秒 */
const FINISH_DELAY = 700;

/**
 * 光るカードの順番を事前に一括で決める
 * - 最後の要素は当選カード
 * - 直前と同じカードは続けない(2枚以上あるとき)
 * - 最後から2番目は当選カード以外(2枚以上あるとき。上の規則から自動的に満たされる)
 * @param {number} cardCount - カード枚数(1 以上)
 * @param {number} winnerIndex - 当選カードのインデックス
 * @param {number} steps - 光る回数
 * @param {Function} [random] - 0 以上 1 未満の乱数を返す関数
 * @returns {number[]} カードのインデックスの配列(長さ = steps)
 */
export function buildHighlightSequence(cardCount, winnerIndex, steps, random = Math.random) {
    const sequence = new Array(steps);
    sequence[steps - 1] = winnerIndex;
    for (let j = steps - 2; j >= 0; j--) {
        if (cardCount === 1) {
            sequence[j] = winnerIndex;
            continue;
        }
        // 直後に光るカードを除いた中から選ぶ
        let pick = Math.floor(random() * (cardCount - 1));
        if (pick >= sequence[j + 1]) pick += 1;
        sequence[j] = pick;
    }
    return sequence;
}

/**
 * カードめくりアニメーション
 * 裏向きのカードの上を光が移動して減速し、止まったカードがめくれる
 */
export class CardFlipAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.cards = [];
        this.isSpinning = false;
        this.timers = new Set();
        this.finishResolve = null;
        // 直近の spin で使った光る順番(カードのインデックス)
        this.lastHighlightSequence = [];
    }

    /**
     * アニメーションを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.render();
    }

    /**
     * 盤面を渡されたメンバーで作り直す(すべて裏向き・強調なし)
     * @param {Array} members - 残りのメンバーリスト
     */
    updateMembers(members) {
        this.members = members;
        this.render();
    }

    /**
     * カードグリッドを描画
     */
    render() {
        this.cards = [];
        this.container.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'card-flip-wrapper';

        const grid = document.createElement('div');
        grid.className = 'card-flip-grid';

        this.members.forEach(member => {
            const card = this.createCard(member);
            grid.appendChild(card.element);
            this.cards.push(card);
        });

        wrapper.appendChild(grid);
        this.container.appendChild(wrapper);
    }

    /**
     * カードを作成(表と裏の2面、初期状態は裏向き)
     * @param {Object} member - メンバー情報
     * @returns {Object} カードオブジェクト
     */
    createCard(member) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card-flip-item';
        cardElement.dataset.memberId = member.id;

        const inner = document.createElement('div');
        inner.className = 'card-flip-inner';

        // 表(アバターと名前)
        const front = document.createElement('div');
        front.className = 'card-flip-face card-flip-front';

        const avatar = document.createElement('div');
        avatar.className = 'card-flip-avatar';

        if (member.avatar) {
            const img = document.createElement('img');
            img.src = member.avatar;
            img.alt = member.displayName;
            avatar.appendChild(img);
        } else {
            avatar.textContent = member.displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'card-flip-name';
        name.textContent = member.displayName;

        front.appendChild(avatar);
        front.appendChild(name);

        // 裏(模様だけ)
        const back = document.createElement('div');
        back.className = 'card-flip-face card-flip-back';

        inner.appendChild(front);
        inner.appendChild(back);
        cardElement.appendChild(inner);

        return {
            element: cardElement,
            member: member
        };
    }

    /**
     * 全カードを裏向き・強調なしの状態に戻す
     */
    resetCards() {
        this.cards.forEach(card => {
            card.element.classList.remove(
                'card-flip-flipped',
                'card-flip-highlight',
                'card-flip-selected',
                'card-flip-unselected'
            );
        });
    }

    /**
     * タイマーを登録して実行予約する
     * @param {Function} fn - 実行する処理
     * @param {number} ms - 待ち時間
     */
    schedule(fn, ms) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            fn();
        }, ms);
        this.timers.add(id);
    }

    /**
     * 走っているタイマーをすべて止める
     */
    clearTimers() {
        this.timers.forEach(id => clearTimeout(id));
        this.timers.clear();
    }

    /**
     * アニメーションを実行
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - 光が当選カードで止まるまでの時間(ミリ秒)
     * @returns {Promise<void>}
     */
    spin(selectedMember, options = {}) {
        if (this.isSpinning) return Promise.resolve();

        const duration = options.duration || 6000;
        const winnerIndex = this.cards.findIndex(c => c.member.id === selectedMember.id);
        if (winnerIndex === -1) {
            return Promise.reject(new Error('選出されたメンバーがカードに存在しません'));
        }

        this.isSpinning = true;
        this.resetCards();

        const times = buildDecelSchedule(duration, { minInterval: 60, maxInterval: 450 });
        const sequence = buildHighlightSequence(this.cards.length, winnerIndex, times.length);
        this.lastHighlightSequence = sequence;

        return new Promise(resolve => {
            this.finishResolve = resolve;

            // 光の移動
            times.forEach((time, step) => {
                this.schedule(() => {
                    this.cards.forEach(card => card.element.classList.remove('card-flip-highlight'));
                    this.cards[sequence[step]].element.classList.add('card-flip-highlight');
                }, time);
            });

            // 光が当選カードで止まったら当選カードをめくる
            this.schedule(() => {
                const winner = this.cards[winnerIndex].element;
                winner.classList.remove('card-flip-highlight');
                winner.classList.add('card-flip-flipped', 'card-flip-selected');
            }, duration);

            // 残りのカードをまとめてめくり、半透明にする
            this.schedule(() => {
                this.cards.forEach((card, i) => {
                    if (i !== winnerIndex) {
                        card.element.classList.add('card-flip-flipped', 'card-flip-unselected');
                    }
                });
            }, duration + OTHERS_FLIP_DELAY);

            // 演出の終了
            this.schedule(() => {
                this.finish();
            }, duration + OTHERS_FLIP_DELAY + FINISH_DELAY);
        });
    }

    /**
     * spin の終了処理
     */
    finish() {
        this.isSpinning = false;
        const resolve = this.finishResolve;
        this.finishResolve = null;
        if (resolve) resolve();
    }

    /**
     * アニメーションを破棄
     */
    destroy() {
        this.clearTimers();
        this.finish();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

