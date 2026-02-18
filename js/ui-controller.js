/**
 * UI コントローラー
 * ユーザーインターフェースの状態管理と更新を担当
 */
export class UIController {
    constructor() {
        this.screens = {
            auth: document.getElementById('auth-screen'),
            guild: document.getElementById('guild-screen'),
            channel: document.getElementById('channel-screen'),
            roulette: document.getElementById('roulette-screen'),
            result: document.getElementById('result-screen')
        };

        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            errorText: document.getElementById('error-text'),
            logoutButton: document.getElementById('logout-button'),
            guildList: document.getElementById('guild-list'),
            channelList: document.getElementById('channel-list'),
            memberList: document.getElementById('member-list'),
            resultList: document.getElementById('result-list'),
            selectCount: document.getElementById('select-count')
        };

        this.currentMembers = [];
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
     * 認証画面を表示
     */
    showAuthScreen() {
        this.hideAllScreens();
        this.screens.auth.classList.remove('hidden');
        this.elements.logoutButton.classList.add('hidden');
    }

    /**
     * ギルド選択画面を表示
     * @param {Array} guilds - ギルドリスト
     */
    showGuildSelection(guilds) {
        this.hideAllScreens();
        this.screens.guild.classList.remove('hidden');
        this.elements.logoutButton.classList.remove('hidden');

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
     */
    showChannelSelection(channels) {
        this.hideAllScreens();
        this.screens.channel.classList.remove('hidden');

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
        const memberCards = this.elements.memberList.querySelectorAll('.member-card');
        const selectedIds = new Set(selected.map(m => m.id));

        // アニメーション: ランダムにハイライト
        for (let i = 0; i < 20; i++) {
            const randomIndex = Math.floor(Math.random() * memberCards.length);
            memberCards.forEach(card => card.classList.remove('selected'));
            memberCards[randomIndex].classList.add('selected');
            await this.sleep(100);
        }

        // 最終結果を表示
        memberCards.forEach(card => {
            card.classList.remove('selected');
            if (selectedIds.has(card.dataset.memberId)) {
                card.classList.add('selected');
            }
        });

        await this.sleep(1000);
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
