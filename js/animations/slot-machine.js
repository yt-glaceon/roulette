/**
 * スロットマシンアニメーション
 * 縦スクロール型のスロットマシン風アニメーション
 * 各列の位置 pos(単位: アイテム1個分)を requestAnimationFrame で毎フレーム計算する
 */
import { easeOutCubic } from './animation-timing.js';

const DEFAULT_ITEM_HEIGHT = 120;
const STOP_RATIOS = [0.6, 0.8, 1.0];
const BASE_SPEED = 15 / 1000; // 基準速度(アイテム/ms) = 15アイテム/秒

/**
 * 0 以上 n 未満に丸める剰余
 * @param {number} a
 * @param {number} n
 * @returns {number}
 */
function mod(a, n) {
    return ((a % n) + n) % n;
}

/**
 * 1列ぶんの動きを計画する(純粋関数)
 * @param {Object} params
 * @param {number} params.pos0 - 開始時の pos(整数。念のため丸める)
 * @param {number} params.n - 列のメンバー数
 * @param {number} params.winnerIndex - 当選者の order 内インデックス
 * @param {number} params.stopTime - 停止時刻 T(ms)
 * @param {number} params.baseSpeed - 基準速度 V0(アイテム/ms)
 * @returns {{pos0:number, S:number, V:number, r:number, D:number, T:number}}
 */
export function planReelMotion({ pos0, n, winnerIndex, stopTime, baseSpeed }) {
    const start = Math.round(pos0);
    const T = stopTime;
    const D = Math.min(1200, T * 0.6);
    const r = Math.min(150, (T - D) * 0.25);
    const K = r / 2 + (T - D - r) + D / 3;
    const S0 = baseSpeed * K;
    // S >= S0 かつ mod(start + S, n) = mod(-winnerIndex, n) を満たす最小の整数 S
    const need = mod(-winnerIndex - start, n);
    const base = Math.ceil(S0);
    const S = base + mod(need - base, n);
    const V = K > 0 ? S / K : 0;
    return { pos0: start, S, V, r, D, T };
}

/**
 * 時刻 t(ms)での pos を返す(純粋関数)
 * @param {{pos0:number, S:number, V:number, r:number, D:number, T:number}} plan
 * @param {number} t - 開始からの経過時間(ms)
 * @returns {number} pos
 */
export function reelPositionAt(plan, t) {
    const { pos0, S, V, r, D, T } = plan;
    if (t <= 0) return pos0;
    if (t >= T) return pos0 + S;
    const decelStart = T - D;
    let moved;
    if (t < r) {
        moved = (V * t * t) / (2 * r);
    } else if (t < decelStart) {
        moved = (V * r) / 2 + V * (t - r);
    } else {
        const u = (t - decelStart) / D;
        moved = (V * r) / 2 + V * (decelStart - r) + ((V * D) / 3) * easeOutCubic(u);
    }
    return pos0 + moved;
}

export class SlotMachineAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.columns = [];
        this.isSpinning = false;
        this.itemHeight = DEFAULT_ITEM_HEIGHT;
        this.rafId = null;
        this._resolveSpin = null;
    }

    /**
     * アニメーションを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.columns = [];

        // コンテナをクリア
        this.container.innerHTML = '';

        // スロットマシンのラッパーを作成
        const wrapper = document.createElement('div');
        wrapper.className = 'slot-machine-wrapper';

        // 3列のスロットを作成
        for (let i = 0; i < 3; i++) {
            const column = this.createColumn(i);
            wrapper.appendChild(column.element);
            this.columns.push(column);
        }

        this.container.appendChild(wrapper);

        this.measureItemHeight();
        this.columns.forEach(column => this.applyPosition(column));
    }

    /**
     * スロット列を作成
     * @param {number} index - 列のインデックス
     * @returns {Object} 列オブジェクト
     */
    createColumn(index) {
        const columnElement = document.createElement('div');
        columnElement.className = 'slot-column';

        const reelContainer = document.createElement('div');
        reelContainer.className = 'slot-reel-container';

        const reel = document.createElement('div');
        reel.className = 'slot-reel';

        // 各列で異なる順序のメンバーリスト(order)を作成
        const order = this.shuffleMembers(index);
        this.fillReel(reel, order);

        reelContainer.appendChild(reel);
        columnElement.appendChild(reelContainer);

        return {
            element: columnElement,
            reel: reel,
            container: reelContainer,
            order: order,
            shuffledMembers: order,
            pos: 0
        };
    }

    /**
     * リールに order を R 回繰り返して並べる
     * @param {HTMLElement} reel - リール要素
     * @param {Array} order - 列のメンバー順
     */
    fillReel(reel, order) {
        reel.innerHTML = '';
        if (order.length === 0) return;
        const repeatCount = 2 + Math.ceil(3 / order.length);
        for (let i = 0; i < repeatCount; i++) {
            order.forEach(member => {
                reel.appendChild(this.createSlotItem(member));
            });
        }
    }

    /**
     * 描画後に .slot-item の実際の高さを測る(0 のときは 120)
     */
    measureItemHeight() {
        const item = this.container.querySelector('.slot-item');
        const measured = item ? item.offsetHeight : 0;
        this.itemHeight = measured > 0 ? measured : DEFAULT_ITEM_HEIGHT;
    }

    /**
     * 列の pos に合わせてリールの位置を反映する
     * @param {Object} column - 列オブジェクト
     */
    applyPosition(column) {
        const n = column.order.length;
        if (n === 0) return;
        const q = mod(-column.pos, n);
        const translateY = -(n + q - 1) * this.itemHeight;
        column.reel.style.transform = `translateY(${translateY}px)`;
    }

    /**
     * 列の中央行にいるメンバーを返す
     * @param {number} columnIndex - 列のインデックス
     * @returns {Object|null} メンバー
     */
    getCenterMember(columnIndex) {
        const column = this.columns[columnIndex];
        if (!column || column.order.length === 0) return null;
        const n = column.order.length;
        return column.order[Math.floor(mod(-Math.round(column.pos), n))];
    }

    /**
     * メンバーを差し替えて盤面を作り直す(各列の pos は丸めて引き継ぐ)
     * @param {Array} members - 新しいメンバーリスト
     */
    updateMembers(members) {
        this.members = members;
        this.columns.forEach((column, index) => {
            const order = this.shuffleMembers(index);
            column.order = order;
            column.shuffledMembers = order;
            column.pos = order.length > 0 ? mod(Math.round(column.pos), order.length) : 0;
            this.fillReel(column.reel, order);
        });
        this.measureItemHeight();
        this.columns.forEach(column => this.applyPosition(column));
    }

    /**
     * 各列用にメンバーをシャッフル
     * @param {number} columnIndex - 列のインデックス
     * @returns {Array} シャッフルされたメンバーリスト
     */
    shuffleMembers(columnIndex) {
        const shuffled = [...this.members];

        // 列ごとに異なるシード値を使ってシャッフル
        // Fisher-Yatesアルゴリズムを使用
        const seed = columnIndex + 1;
        let random = seed * 9301 + 49297; // 簡易的な疑似乱数生成

        for (let i = shuffled.length - 1; i > 0; i--) {
            random = (random * 9301 + 49297) % 233280;
            const j = Math.floor((random / 233280) * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    /**
     * スロットアイテムを作成
     * @param {Object} member - メンバー情報
     * @returns {HTMLElement} スロットアイテム
     */
    createSlotItem(member) {
        const item = document.createElement('div');
        item.className = 'slot-item';

        const avatar = document.createElement('div');
        avatar.className = 'slot-avatar';

        if (member.avatar) {
            const img = document.createElement('img');
            img.src = member.avatar;
            img.alt = member.displayName;
            avatar.appendChild(img);
        } else {
            avatar.textContent = member.displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'slot-name';
        name.textContent = member.displayName;

        item.appendChild(avatar);
        item.appendChild(name);

        return item;
    }

    /**
     * アニメーションを実行
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - アニメーション時間（ミリ秒）。最後の列が止まるまでの時間
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;

        const duration = options.duration || 6000;

        // 各列の計画を立てる(当選者が見つからなければ開始しない)
        const plans = [];
        for (let k = 0; k < this.columns.length; k++) {
            const column = this.columns[k];
            const winnerIndex = column.order.findIndex(m => m.id === selectedMember.id);
            if (winnerIndex < 0) {
                throw new Error('選出されたメンバーがスロットに存在しません');
            }
            plans.push(planReelMotion({
                pos0: column.pos,
                n: column.order.length,
                winnerIndex,
                stopTime: duration * STOP_RATIOS[k],
                baseSpeed: BASE_SPEED
            }));
        }

        this.isSpinning = true;
        const startTime = performance.now();

        await new Promise(resolve => {
            this._resolveSpin = resolve;
            const frame = () => {
                if (!this.isSpinning) return; // destroy 後は何も更新しない
                const t = performance.now() - startTime;
                const finished = t >= duration;
                this.columns.forEach((column, k) => {
                    column.pos = finished
                        ? plans[k].pos0 + plans[k].S
                        : reelPositionAt(plans[k], t);
                    this.applyPosition(column);
                });
                if (finished) {
                    this.rafId = null;
                    this._resolveSpin = null;
                    resolve();
                    return;
                }
                this.rafId = requestAnimationFrame(frame);
            };
            this.rafId = requestAnimationFrame(frame);
        });

        this.isSpinning = false;
    }

    /**
     * アニメーションを破棄
     */
    destroy() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        this.isSpinning = false;
        if (this._resolveSpin) {
            const resolve = this._resolveSpin;
            this._resolveSpin = null;
            resolve();
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
