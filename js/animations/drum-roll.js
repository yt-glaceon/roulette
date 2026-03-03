/**
 * ドラムロールアニメーション
 * 中央で高速切り替え→減速→停止の演出
 */
export class DrumRollAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.currentIndex = 0;
        this.isSpinning = false;
        this.intervalId = null;
        this.displayElement = null;
    }

    /**
     * アニメーションを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.currentIndex = 0;
        
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
     */
    showMember(member) {
        if (!this.displayElement) return;
        
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
            this.displayElement.style.transition = 'all 0.2s ease-out';
            this.displayElement.style.opacity = '1';
            this.displayElement.style.transform = 'scale(1)';
        });
    }

    /**
     * アニメーションを実行
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {Object} options - オプション設定
     * @param {number} options.duration - アニメーション時間（ミリ秒）
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;
        
        const duration = options.duration || 6000;
        this.isSpinning = true;
        
        const startTime = Date.now();
        let currentInterval = 50; // 初期速度: 50ms
        const maxInterval = 500; // 最終速度: 500ms
        
        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;
                
                if (progress >= 1) {
                    // アニメーション完了
                    this.showMember(selectedMember);
                    this.isSpinning = false;
                    
                    // 最終的な強調表示
                    setTimeout(() => {
                        this.displayElement.style.transition = 'all 0.3s ease-out';
                        this.displayElement.style.transform = 'scale(1.1)';
                        setTimeout(() => {
                            this.displayElement.style.transform = 'scale(1)';
                        }, 300);
                    }, 100);
                    
                    resolve();
                    return;
                }
                
                // 減速カーブを計算（指数関数的に減速）
                const slowdownFactor = Math.pow(progress, 2);
                currentInterval = 50 + (maxInterval - 50) * slowdownFactor;
                
                // 次のメンバーを表示
                this.currentIndex = (this.currentIndex + 1) % this.members.length;
                this.showMember(this.members[this.currentIndex]);
                
                // 次のフレームをスケジュール
                setTimeout(animate, currentInterval);
            };
            
            animate();
        });
    }

    /**
     * アニメーションを破棄
     */
    destroy() {
        this.isSpinning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
