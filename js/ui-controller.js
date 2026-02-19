import { RouletteWheel } from './roulette-wheel.js';

/**
 * UI コントローラー
 * ユーザーインターフェースの状態管理と更新を担当
 */
export class UIController {
    constructor() {
        this.screens = {
            channel: document.getElementById('channel-screen'),
            roulette: document.getElementById('roulette-screen'),
            result: document.getElementById('result-screen')
        };

        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            channelList: document.getElementById('channel-list'),
            memberList: document.getElementById('member-list'),
            resultList: document.getElementById('result-list'),
            selectCount: document.getElementById('select-count'),
            showResultsContainer: document.getElementById('show-results-container')
        };

        this.currentMembers = [];
        this.currentSelectedMembers = [];
        this.rouletteWheel = null;
    }

    /**
     * すべての画面を非表示
     */
    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    /**
     * ギルド選択画面を表示
     * @param {Array} guilds - ギルドリスト
     */
    showGuildSelection(guilds) {
        this.hideAllScreens();
        this.screens.guild.classList.remove('hidden');

        // ギルドリストをクリア
        this.elements.guildList.innerHTML = '';

        if (guilds.length === 0) {
            this.elements.guildList.innerHTML = '<p>アクセス可能なサーバーがありません</p>';
            return;
        }

        // ギルドカードを作成
        guilds.forEach(guild => {
            const card = this.createGuildCard(guild);
            this.elements.guildList.appendChild(card);
        });
    }

    /**
     * ギルドカードを作成
     * @param {Object} guild - ギルド情報
     * @returns {HTMLElement} ギルドカード
     */
    createGuildCard(guild) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.guildId = guild.id;

        const icon = document.createElement('div');
        icon.className = 'card-icon';
        
        if (guild.icon) {
            const img = document.createElement('img');
            img.src = guild.icon;
            img.alt = guild.name;
            icon.appendChild(img);
        } else {
            icon.textContent = guild.name.charAt(0).toUpperCase();
        }

        const content = document.createElement('div');
        content.className = 'card-content';
        
        const name = document.createElement('h3');
        name.textContent = guild.name;
        
        content.appendChild(name);
        card.appendChild(icon);
        card.appendChild(content);

        return card;
    }

    /**
     * チャネル選択画面を表示
     * @param {Array} channels - チャネルリスト
     * @param {string} guildName - サーバー名（オプション）
     */
    showChannelSelection(channels, guildName = null) {
        this.hideAllScreens();
        this.screens.channel.classList.remove('hidden');

        // サーバー名を表示
        const heading = this.screens.channel.querySelector('h2');
        if (heading && guildName) {
            heading.textContent = `${guildName} - ボイスチャネルを選択`;
        }

        // チャネルリストをクリア
        this.elements.channelList.innerHTML = '';

        if (channels.length === 0) {
            this.elements.channelList.innerHTML = '<p>ボイスチャネルがありません</p>';
            return;
        }

        // チャネルカードを作成
        channels.forEach(channel => {
            const card = this.createChannelCard(channel);
            this.elements.channelList.appendChild(card);
        });
    }

    /**
     * チャネルカードを作成
     * @param {Object} channel - チャネル情報
     * @returns {HTMLElement} チャネルカード
     */
    createChannelCard(channel) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.channelId = channel.id;

        const icon = document.createElement('div');
        icon.className = 'card-icon';
        icon.textContent = '🔊';

        const content = document.createElement('div');
        content.className = 'card-content';
        
        const name = document.createElement('h3');
        name.textContent = channel.name;
        
        content.appendChild(name);
        card.appendChild(icon);
        card.appendChild(content);

        return card;
    }

    /**
     * メンバーリストとルーレット画面を表示
     * @param {Array} members - メンバーリスト
     */
    showRouletteScreen(members) {
        this.hideAllScreens();
        this.screens.roulette.classList.remove('hidden');
        this.currentMembers = members;

        // 結果を見るボタンを非表示
        if (this.elements.showResultsContainer) {
            this.elements.showResultsContainer.classList.add('hidden');
        }

        // ルーレットホイールコンテナを削除（前回の残骸をクリーンアップ）
        const wheelContainer = document.getElementById('roulette-wheel-container');
        if (wheelContainer) {
            wheelContainer.remove();
        }

        // メンバーリストとコントロールを表示状態に戻す
        this.elements.memberList.style.display = '';
        const controls = document.querySelector('.roulette-controls');
        if (controls) controls.style.display = '';

        // メンバーリストをクリア
        this.elements.memberList.innerHTML = '';

        if (members.length === 0) {
            this.elements.memberList.innerHTML = '<p>メンバーがいません</p>';
            return;
        }

        // 選出人数の最大値を設定
        this.elements.selectCount.max = members.length;
        this.elements.selectCount.value = Math.min(1, members.length);

        // メンバーカードを作成
        members.forEach(member => {
            const card = this.createMemberCard(member);
            this.elements.memberList.appendChild(card);
        });
    }

    /**
     * メンバーカードを作成
     * @param {Object} member - メンバー情報
     * @returns {HTMLElement} メンバーカード
     */
    createMemberCard(member) {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.dataset.memberId = member.id;

        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        
        if (member.avatar) {
            const img = document.createElement('img');
            img.src = member.avatar;
            img.alt = member.displayName;
            avatar.appendChild(img);
        } else {
            avatar.textContent = member.displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'member-name';
        name.textContent = member.displayName;

        card.appendChild(avatar);
        card.appendChild(name);

        return card;
    }

    /**
     * ルーレット結果を表示
     * @param {Array} selectedMembers - 選出されたメンバー
     */
    showResults(selectedMembers) {
        this.hideAllScreens();
        this.screens.result.classList.remove('hidden');

        // 結果リストをクリア
        this.elements.resultList.innerHTML = '';

        // 結果カードを作成
        selectedMembers.forEach((member, index) => {
            const card = this.createResultCard(member, index + 1);
            this.elements.resultList.appendChild(card);
        });
    }

    /**
     * 結果カードを作成
     * @param {Object} member - メンバー情報
     * @param {number} order - 選出順序
     * @returns {HTMLElement} 結果カード
     */
    createResultCard(member, order) {
        const card = document.createElement('div');
        card.className = 'result-card';

        const orderBadge = document.createElement('div');
        orderBadge.className = 'result-order';
        orderBadge.textContent = order;

        const avatar = document.createElement('div');
        avatar.className = 'member-avatar';
        
        if (member.avatar) {
            const img = document.createElement('img');
            img.src = member.avatar;
            img.alt = member.displayName;
            avatar.appendChild(img);
        } else {
            avatar.textContent = member.displayName.charAt(0).toUpperCase();
        }

        const name = document.createElement('div');
        name.className = 'member-name';
        name.textContent = member.displayName;

        card.appendChild(orderBadge);
        card.appendChild(avatar);
        card.appendChild(name);

        return card;
    }

    /**
     * ルーレットアニメーションを実行
     * @param {Array} members - 全メンバー
     * @param {Array} selected - 選出されたメンバー
     * @returns {Promise<void>}
     */
    async animateRoulette(members, selected) {
        // 選出されたメンバーを保存
        this.currentSelectedMembers = selected;
        
        // ルーレット画面を表示
        this.hideAllScreens();
        this.screens.roulette.classList.remove('hidden');
        
        // メンバーリストとコントロールを非表示
        this.elements.memberList.style.display = 'none';
        const controls = document.querySelector('.roulette-controls');
        if (controls) controls.style.display = 'none';
        
        // 結果を見るボタンを非表示（アニメーション中）
        if (this.elements.showResultsContainer) {
            this.elements.showResultsContainer.classList.add('hidden');
        }
        
        // 既存のルーレットホイールコンテナを削除
        let wheelContainer = document.getElementById('roulette-wheel-container');
        if (wheelContainer) {
            wheelContainer.remove();
        }
        
        // ルーレットホイール用のコンテナを作成
        wheelContainer = document.createElement('div');
        wheelContainer.id = 'roulette-wheel-container';
        wheelContainer.style.display = 'flex';
        wheelContainer.style.justifyContent = 'center';
        wheelContainer.style.alignItems = 'center';
        wheelContainer.style.padding = '20px';
        wheelContainer.style.flexDirection = 'column';
        this.screens.roulette.querySelector('.container').insertBefore(
            wheelContainer,
            this.elements.memberList
        );
        
        // ルーレットホイールを初期化
        this.rouletteWheel = new RouletteWheel(wheelContainer);
        this.rouletteWheel.initialize(members);
        
        // 各選出メンバーに対してルーレットを回す
        for (let i = 0; i < selected.length; i++) {
            const isLastSpin = i === selected.length - 1;
            
            if (isLastSpin) {
                // 最後のスピンの場合、アニメーション完了を待たずにボタンを表示
                const spinPromise = this.rouletteWheel.spin(selected[i]);
                
                // アニメーションの80%完了時点でボタンを表示
                setTimeout(() => {
                    if (this.elements.showResultsContainer) {
                        this.elements.showResultsContainer.classList.remove('hidden');
                        
                        // ボタンが見える位置までスクロール
                        setTimeout(() => {
                            this.elements.showResultsContainer.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'center' 
                            });
                        }, 100);
                    }
                }, 1600);
                
                await spinPromise;
            } else {
                await this.rouletteWheel.spin(selected[i]);
                await this.sleep(500);
            }
        }
    }

    /**
     * 保存された結果を表示
     */
    showSavedResults() {
        // ルーレットホイールをクリーンアップ
        if (this.rouletteWheel) {
            this.rouletteWheel.destroy();
            this.rouletteWheel = null;
        }
        const wheelContainer = document.getElementById('roulette-wheel-container');
        if (wheelContainer) {
            wheelContainer.remove();
        }
        
        // 結果画面を表示
        this.showResults(this.currentSelectedMembers);
    }

    /**
     * ローディング表示
     * @param {boolean} show - 表示するかどうか
     */
    showLoading(show) {
        if (show) {
            this.elements.loading.classList.remove('hidden');
        } else {
            this.elements.loading.classList.add('hidden');
        }
    }

    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
    }

    /**
     * エラーメッセージを非表示
     */
    hideError() {
        this.elements.errorMessage.classList.add('hidden');
    }

    /**
     * 成功メッセージを表示（簡易実装）
     * @param {string} message - 成功メッセージ
     */
    showSuccess(message) {
        // 簡易的にアラートで表示
        alert(message);
    }

    /**
     * 指定時間待機
     * @param {number} ms - ミリ秒
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
