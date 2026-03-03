/**
 * スロットマシンアニメーション
 * 縦スクロール型のスロットマシン風アニメーション
 */
export class SlotMachineAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.columns = [];
        this.isSpinning = false;
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
        
        // メンバーを複数回繰り返して表示（スクロール用）
        const repeatCount = 10;
        for (let i = 0; i < repeatCount; i++) {
            this.members.forEach(member => {
                const item = this.createSlotItem(member);
                reel.appendChild(item);
            });
        }
        
        reelContainer.appendChild(reel);
        columnElement.appendChild(reelContainer);
        
        return {
            element: columnElement,
            reel: reel,
            container: reelContainer
        };
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
     * @param {number} options.duration - アニメーション時間（ミリ秒）
     * @returns {Promise<void>}
     */
    async spin(selectedMember, options = {}) {
        if (this.isSpinning) return;
        
        const duration = options.duration || 6000;
        this.isSpinning = true;
        
        // 選出されたメンバーのインデックスを取得
        const selectedIndex = this.members.findIndex(m => m.id === selectedMember.id);
        
        console.log(`[SlotMachine] アニメーション開始: 選出メンバー=${selectedMember.displayName} (インデックス=${selectedIndex})`);
        console.log(`[SlotMachine] メンバーリスト: ${this.members.map((m, i) => `${i}:${m.displayName}`).join(', ')}`);
        
        // 各列を順番にアニメーション
        const columnDelay = 1000; // 列ごとの停止時間差
        
        for (let i = 0; i < this.columns.length; i++) {
            const column = this.columns[i];
            // 列が左から右へ順番に停止するように計算
            // 列0: 1 * columnDelay, 列1: 2 * columnDelay, 列2: 3 * columnDelay
            const columnDuration = (i + 1) * columnDelay;
            
            // 列をアニメーション（非同期で開始）
            this.animateColumn(column, selectedMember, selectedIndex, columnDuration);
            
            // 次の列まで待機
            if (i < this.columns.length - 1) {
                await this.sleep(columnDelay);
            }
        }
        
        // 最後の列が停止するまで待機
        // 列2のcolumnDurationは3 * columnDelayなので、それに合わせる
        await this.sleep(this.columns.length * columnDelay);
        
        this.isSpinning = false;
    }

    /**
     * 列をアニメーション
     * @param {Object} column - 列オブジェクト
     * @param {Object} selectedMember - 選出されたメンバー
     * @param {number} selectedIndex - 選出されたメンバーのインデックス
     * @param {number} duration - アニメーション時間
     */
    animateColumn(column, selectedMember, selectedIndex, duration) {
            const reel = column.reel;
            const itemHeight = 120; // スロットアイテムの高さ
            const membersCount = this.members.length;

            // 目標位置を計算（選出されたメンバーが中央に来るように）
            // 表示領域の中央にアイテムを配置するため、1アイテム分上にずらす
            const repeatIndex = 5; // 5回目の繰り返しで停止
            const targetPosition = -(repeatIndex * membersCount + selectedIndex) * itemHeight - itemHeight;
            
            console.log(`[animateColumn] selectedIndex=${selectedIndex}, membersCount=${membersCount}, targetPosition=${targetPosition}px, duration=${duration}ms`);

            // 初期位置をリセット（transitionなし）
            reel.style.transition = 'none';
            reel.style.transform = 'translateY(0px)';

            // 次のフレームでアニメーション開始（transitionを確実に適用）
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    reel.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
                    reel.style.transform = `translateY(${targetPosition}px)`;
                });
            });
        }

    /**
     * 指定時間待機
     * @param {number} ms - ミリ秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * アニメーションを破棄
     */
    destroy() {
        this.isSpinning = false;
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
