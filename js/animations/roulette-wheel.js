import { easeOutCubic, pickOffsetInSection } from './animation-timing.js';

// 停止位置で区画の両端から避ける比率
const SECTION_MARGIN = 0.15;

/**
 * ルーレットホイールコンポーネント
 * 円グラフ型のルーレットで針が回るアニメーション
 */
export class RouletteWheel {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.members = [];
        this.rotation = 0;
        this.isSpinning = false;
        this.targetRotation = 0;
        this.animationId = null;
        this.resolveSpin = null;
    }

    /**
     * ルーレットを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.rotation = 0;

        // キャンバスを作成
        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = 500;
        this.canvas.height = 500;
        this.canvas.style.maxWidth = '100%';
        this.canvas.style.height = 'auto';
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');

        // 初期描画
        this.draw();
    }

    /**
     * ルーレットを描画
     */
    draw() {
        const ctx = this.ctx;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = 200;

        // 背景をクリア
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // メンバーごとのセクションを描画
        const anglePerMember = (Math.PI * 2) / this.members.length;

        this.members.forEach((member, index) => {
            const startAngle = this.rotation + (anglePerMember * index);
            const endAngle = startAngle + anglePerMember;

            // セクションの色（交互に色を変える）
            const colors = ['#5865F2', '#57F287', '#FEE75C', '#ED4245', '#EB459E'];
            ctx.fillStyle = colors[index % colors.length];

            // セクションを描画
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();

            // 境界線
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();

            // テキストを描画
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(startAngle + anglePerMember / 2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(member.displayName, radius - 20, 5);
            ctx.restore();
        });

        // 中央の円
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();

        // 針を描画（上部に固定）
        this.drawPointer(centerX, centerY, radius);
    }

    /**
     * 針を描画
     */
    drawPointer(centerX, centerY, radius) {
        const ctx = this.ctx;

        // 針の位置（上部）
        ctx.save();
        ctx.translate(centerX, centerY);

        // 針の三角形
        ctx.beginPath();
        ctx.moveTo(0, -radius - 10);
        ctx.lineTo(-15, -radius - 30);
        ctx.lineTo(15, -radius - 30);
        ctx.closePath();
        ctx.fillStyle = '#ED4245';
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    /**
     * ルーレットを回転
     * 現在の回転角から回り始め、選出されたメンバーの区画内のランダムな位置で止まる
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - 回転時間（ミリ秒）デフォルト: 6000
     * @param {number} options.minRotations - 最低回転数 デフォルト: 5
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;

        const duration = options.duration || 6000;
        const minRotations = options.minRotations || 5;

        this.isSpinning = true;

        // 選出されたメンバーのインデックスを取得
        const selectedIndex = this.members.findIndex(m => m.id === selectedMember.id);
        const anglePerMember = (Math.PI * 2) / this.members.length;

        // 現在の回転角からの相対で目標角度を計算
        const startRotation = this.rotation;
        const delta = this.calculateTargetAngle(selectedIndex, anglePerMember);
        const extraRotations = minRotations + Math.floor(Math.random() * 3); // minRotations + 0〜2
        this.targetRotation = startRotation + (Math.PI * 2 * extraRotations) + delta;

        const startTime = Date.now();

        return new Promise((resolve) => {
            this.resolveSpin = resolve;
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                this.rotation = startRotation + (this.targetRotation - startRotation) * easeOutCubic(progress);
                this.draw();

                if (progress < 1) {
                    this.animationId = requestAnimationFrame(animate);
                } else {
                    // 完了時に目標角度に正確に設定
                    this.animationId = null;
                    this.rotation = this.targetRotation;
                    this.draw();
                    this.isSpinning = false;
                    this.resolveSpin = null;
                    resolve();
                }
            };

            animate();
        });
    }

    /**
     * 現在の回転角から、選出区画内のランダムな位置を針に合わせるための回転量を計算
     * 針は上(3π/2、Canvas 座標で -π/2)に固定。区画 i は rotation + w*i 〜 rotation + w*(i+1) を占める。
     * @param {number} selectedIndex - 選出されたメンバーのインデックス
     * @param {number} anglePerMember - メンバーごとの角度
     * @returns {number} 現在の回転角に加える回転量（0〜2π）
     */
    calculateTargetAngle(selectedIndex, anglePerMember) {
        const pointerAngle = Math.PI * 3 / 2;
        const f = pickOffsetInSection(Math.random, SECTION_MARGIN);
        const stopOffset = anglePerMember * selectedIndex + anglePerMember * f;
        return this.normalizeAngle(pointerAngle - stopOffset - this.normalizeAngle(this.rotation));
    }

    /**
     * 針が指している区画のメンバーのインデックスを取得
     * @returns {number} メンバーのインデックス（メンバーがいなければ -1）
     */
    getPointerIndex() {
        const n = this.members.length;
        if (n === 0) return -1;

        const anglePerMember = (Math.PI * 2) / n;
        // 区画の座標系（rotation を引いた角度）での針の位置
        const relative = this.normalizeAngle(Math.PI * 3 / 2 - this.rotation);
        return Math.min(Math.floor(relative / anglePerMember), n - 1);
    }

    /**
     * 角度を0〜2πの範囲に正規化
     * @param {number} angle - 角度（ラジアン）
     * @returns {number} 正規化された角度
     */
    normalizeAngle(angle) {
        let normalized = angle % (Math.PI * 2);
        if (normalized < 0) {
            normalized += Math.PI * 2;
        }
        return normalized;
    }

    /**
     * メンバーを差し替えて再描画（回転角は引き継ぐ）
     * @param {Array} members - 新しいメンバーリスト
     */
    updateMembers(members) {
        this.members = members;
        if (this.ctx) {
            this.draw();
        }
    }

    /**
     * アニメーションを停止
     */
    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isSpinning = false;
        if (this.resolveSpin) {
            const resolve = this.resolveSpin;
            this.resolveSpin = null;
            resolve();
        }
    }

    /**
     * ルーレットを破棄
     */
    destroy() {
        this.stop();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
