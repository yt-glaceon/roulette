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
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - 回転時間（ミリ秒）デフォルト: 6000
     * @param {number} options.minRotations - 最低回転数 デフォルト: 5
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;
        
        // デフォルト値を設定
        const duration = options.duration || 6000;
        const minRotations = options.minRotations || 5;
        
        this.isSpinning = true;
        
        // 選出されたメンバーのインデックスを取得
        const selectedIndex = this.members.findIndex(m => m.id === selectedMember.id);
        const anglePerMember = (Math.PI * 2) / this.members.length;
        
        // 目標角度を計算（白線回避ロジックを使用）
        const targetAngle = this.calculateTargetAngle(selectedIndex, anglePerMember);
        
        // 最低回転数を保証（minRotations 以上）
        const extraRotations = minRotations + Math.random() * 2;
        this.targetRotation = this.rotation + (Math.PI * 2 * extraRotations) + targetAngle;
        
        // アニメーション開始
        const startTime = Date.now();
        const startRotation = this.rotation;
        
        console.log(`[RouletteWheel] アニメーション開始: duration=${duration}ms, 選出メンバー=${selectedMember.displayName}`);
        
        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // イージング関数（減速）
                const easeOut = 1 - Math.pow(1 - progress, 3);
                
                // 開始角度から目標角度まで補間
                this.rotation = startRotation + (this.targetRotation - startRotation) * easeOut;
                
                this.draw();
                
                if (progress < 1) {
                    this.animationId = requestAnimationFrame(animate);
                } else {
                    // アニメーション完了時に目標角度に正確に設定
                    this.rotation = this.targetRotation;
                    this.draw();
                    this.isSpinning = false;
                    const totalTime = Date.now() - startTime;
                    console.log(`[RouletteWheel] アニメーション完了: 実際の時間=${totalTime}ms`);
                    resolve();
                }
            };
            
            animate();
        });
    }
    /**
     * 停止角度を計算（白線回避）
     * @param {number} selectedIndex - 選出されたメンバーのインデックス
     * @param {number} anglePerMember - メンバーごとの角度
     * @returns {number} 調整された停止角度
     */
    calculateTargetAngle(selectedIndex, anglePerMember) {
        // セクションの中央を基準とする
        const sectionCenter = anglePerMember / 2;
        
        // 基本の目標角度（選出されたメンバーのセクション中央が針に来るように）
        let targetAngle = -(anglePerMember * selectedIndex) - sectionCenter;
        
        // 白線からの距離を確認（5度 = 5 * Math.PI / 180 ラジアン）
        const whiteLineThreshold = 5 * Math.PI / 180;
        
        // セクション中央からのずれを計算（-sectionCenter から +sectionCenter の範囲）
        // 0がセクション中央、±sectionCenterが白線
        const offsetFromCenter = 0; // デフォルトは中央
        
        // 白線からの最小距離を確保
        // セクション中央を基準に、白線から whiteLineThreshold 以上離れた位置に調整
        const maxOffset = sectionCenter - whiteLineThreshold;
        
        // ランダムなオフセットを追加（中央付近に収まるように）
        const randomOffset = (Math.random() - 0.5) * maxOffset * 0.5;
        
        // 最終的な目標角度
        targetAngle += randomOffset;
        
        return targetAngle;
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
