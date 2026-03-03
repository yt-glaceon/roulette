/**
 * カードめくりアニメーション
 * 全メンバーをグリッド表示し、ランダムに光らせて選出を演出
 */
export class CardFlipAnimation {
    constructor(container) {
        this.container = container;
        this.members = [];
        this.cards = [];
        this.isSpinning = false;
    }

    /**
     * アニメーションを初期化
     * @param {Array} members - メンバーリスト
     */
    initialize(members) {
        this.members = members;
        this.cards = [];
        
        // コンテナをクリア
        this.container.innerHTML = '';
        
        // カードグリッドを作成
        const wrapper = document.createElement('div');
        wrapper.className = 'card-flip-wrapper';
        
        const grid = document.createElement('div');
        grid.className = 'card-flip-grid';
        
        // 各メンバーのカードを作成
        this.members.forEach(member => {
            const card = this.createCard(member);
            grid.appendChild(card.element);
            this.cards.push(card);
        });
        
        wrapper.appendChild(grid);
        this.container.appendChild(wrapper);
    }

    /**
     * カードを作成
     * @param {Object} member - メンバー情報
     * @returns {Object} カードオブジェクト
     */
    createCard(member) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card-flip-item';
        cardElement.dataset.memberId = member.id;
        
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
        
        cardElement.appendChild(avatar);
        cardElement.appendChild(name);
        
        return {
            element: cardElement,
            member: member
        };
    }

    /**
     * カードを強調表示
     * @param {HTMLElement} cardElement - カード要素
     * @param {boolean} isSelected - 選出されたかどうか
     */
    highlightCard(cardElement, isSelected) {
        if (isSelected) {
            cardElement.classList.add('card-flip-selected');
        } else {
            cardElement.classList.add('card-flip-highlight');
            setTimeout(() => {
                cardElement.classList.remove('card-flip-highlight');
            }, 200);
        }
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
        
        // ランダムな順序でカードを光らせる
        const shuffledCards = [...this.cards].sort(() => Math.random() - 0.5);
        const highlightInterval = 100; // 0.1秒間隔
        const highlightDuration = duration * 0.7; // 全体の70%の時間でハイライト
        const highlightCount = Math.floor(highlightDuration / highlightInterval);
        
        // ランダムハイライトフェーズ
        for (let i = 0; i < highlightCount; i++) {
            const card = shuffledCards[i % shuffledCards.length];
            this.highlightCard(card.element, false);
            await this.sleep(highlightInterval);
        }
        
        // 選出されたカードを見つける
        const selectedCard = this.cards.find(c => c.member.id === selectedMember.id);
        
        if (selectedCard) {
            // 選出カードを強調
            this.highlightCard(selectedCard.element, true);
            
            // 非選出カードを半透明化
            this.cards.forEach(card => {
                if (card.member.id !== selectedMember.id) {
                    card.element.classList.add('card-flip-unselected');
                }
            });
        }
        
        // 残りの時間待機
        const remainingTime = duration - highlightDuration;
        await this.sleep(remainingTime);
        
        this.isSpinning = false;
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
