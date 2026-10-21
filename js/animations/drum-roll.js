import { buildDecelSchedule } from './animation-timing.js';

const MIN_INTERVAL = 50;
const MAX_INTERVAL = 400;
// buildDecelSchedule は steps 指定時に最短間隔を補正しないため、ここで確認する
const MIN_SAFE_INTERVAL = 20;

const minIntervalOf = (times) =>
    Math.min(...times.map((t, i) => (i === 0 ? t : t - times[i - 1])));

const mod = (a, m) => ((a % m) + m) % m;

/**
 * ドラムロールアニメーション
 * 減速しながら1人ずつ切り替わり、最後の切り替えで当選者が表示される
 */
export class DrumRollAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.currentIndex = 0;
        this.isSpinning = false;
        this.timers = new Set();
        this.resolveSpin = null;
        this.displayElement = null;
    }

    /**
     * アニメーションを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.currentIndex = 0;
        this.clearTimers();

        // コンテナをクリア
        this.container.innerHTML = '';

        // ドラムロール表示エリアを作成
        const wrapper = document.createElement('div');
        wrapper.className = 'drum-roll-wrapper';

        const display = document.createElement('div');
        display.className = 'drum-roll-display';

        this.displayElement = display;
        wrapper.appendChild(display);
        this.container.appendChild(wrapper);

        // 初期メンバーを表示
        if (this.members.length > 0) {
            this.showMember(this.members[0]);
        }
    }

    /**
     * メンバーを表示
     * @param {Object} member - メンバー情報
     * @param {boolean} emphasize - true なら rAF 内で scale(1.1) に拡大する(確定後の強調用)
     */
    showMember(member, emphasize = false) {
        if (!this.displayElement || !member) return;

        this.displayElement.innerHTML = '';

        const avatar = document.createElement('div');
        avatar.className = 'drum-roll-avatar';

        if (member.avatar) {
            const img = document.createElement('img');
            img.src = member.avatar;
            img.alt = member.displayName;
            avatar.appendChild(img);
        } else {
            avatar.textContent = member.displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'drum-roll-name';
        name.textContent = member.displayName;

        this.displayElement.appendChild(avatar);
        this.displayElement.appendChild(name);

        // フェードインアニメーション
        this.displayElement.style.opacity = '0';
        this.displayElement.style.transform = 'scale(0.8)';

        requestAnimationFrame(() => {
            if (!this.displayElement) return;
            this.displayElement.style.transition = 'all 0.2s ease-out';
            this.displayElement.style.opacity = '1';
            this.displayElement.style.transform = emphasize ? 'scale(1.1)' : 'scale(1)';
        });
    }

    /**
     * 切り替え時刻のスケジュールを作る。
     * (currentIndex + N') mod 人数 = 当選者のインデックス を満たす N' のうち、
     * 減速スケジュールの切り替え回数 N 以上で最小のものを選ぶ。
     * 最短間隔が 20ms を下回る場合は N 未満で最大のものを選ぶ(1 未満になる場合は元のまま)。
     * @param {number} duration - アニメーション時間(ms)
     * @param {number} winnerIndex - 当選者のインデックス
     * @returns {number[]} 切り替え時刻の配列(長さ N')
     */
    buildSchedule(duration, winnerIndex) {
        const len = this.members.length;
        const options = { minInterval: MIN_INTERVAL, maxInterval: MAX_INTERVAL };
        const base = buildDecelSchedule(duration, options);
        const n = base.length;

        const steps = n + mod(winnerIndex - this.currentIndex - n, len);
        let schedule = steps === n ? base : buildDecelSchedule(duration, { ...options, steps });

        if (len > 1 && minIntervalOf(schedule) < MIN_SAFE_INTERVAL) {
            const lower = steps - len;
            if (lower >= 1) {
                schedule = buildDecelSchedule(duration, { ...options, steps: lower });
            }
        }
        return schedule;
    }

    /**
     * タイマーを登録する(destroy で止められるよう保持)
     */
    setTimer(callback, delay) {
        const id = setTimeout(() => {
            this.timers.delete(id);
            callback();
        }, delay);
        this.timers.add(id);
        return id;
    }

    clearTimers() {
        this.timers.forEach((id) => clearTimeout(id));
        this.timers.clear();
    }

    /**
     * アニメーションを実行
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - アニメーション時間（ミリ秒）。最後の切り替えで当選者が表示されるまでの時間
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;
        if (this.members.length === 0) return;

        const duration = options.duration || 6000;

        let winnerIndex = this.members.findIndex((m) => m.id === selectedMember.id);
        if (winnerIndex < 0) winnerIndex = this.members.indexOf(selectedMember);
        if (winnerIndex < 0) {
            throw new Error('当選者がメンバーに含まれていません');
        }
        this.isSpinning = true;

        // 開始時に表示中の人を表示し直してから切り替えを始める
        this.currentIndex = Math.min(this.currentIndex, this.members.length - 1);
        this.showMember(this.members[this.currentIndex]);

        const schedule = this.buildSchedule(duration, winnerIndex);
        const startTime = Date.now();

        return new Promise((resolve) => {
            this.resolveSpin = resolve;

            const finish = () => {
                this.resolveSpin = null;
                resolve();
            };

            const step = (k) => {
                this.currentIndex = (this.currentIndex + 1) % this.members.length;
                const isLast = k >= schedule.length - 1;
                this.showMember(this.members[this.currentIndex], isLast);

                if (!isLast) {
                    const delay = Math.max(0, schedule[k + 1] - (Date.now() - startTime));
                    this.setTimer(() => step(k + 1), delay);
                    return;
                }

                // 最後の切り替えで当選者が表示された。確定後の強調は duration の外(約400ms)
                this.isSpinning = false;
                if (!this.displayElement) {
                    finish();
                    return;
                }
                this.setTimer(() => {
                    if (this.displayElement) {
                        this.displayElement.style.transform = 'scale(1)';
                    }
                    this.setTimer(finish, 200);
                }, 200);
            };

            this.setTimer(() => step(0), Math.max(0, schedule[0]));
        });
    }

    /**
     * メンバーを差し替える。表示中の人が残っていればそのインデックスに、
     * いなければ min(currentIndex, 人数 - 1) にする。表示は次の spin 開始時に更新する。
     * @param {Array} members - 新しいメンバーリスト
     */
    updateMembers(members) {
        const current = this.members[this.currentIndex];
        const found = current ? members.findIndex((m) => m.id === current.id) : -1;
        this.members = members;
        this.currentIndex = found >= 0
            ? found
            : Math.max(0, Math.min(this.currentIndex, members.length - 1));
    }

    /**
     * アニメーションを破棄
     */
    destroy() {
        this.isSpinning = false;
        this.clearTimers();
        if (this.resolveSpin) {
            const resolve = this.resolveSpin;
            this.resolveSpin = null;
            resolve();
        }
        this.displayElement = null;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
