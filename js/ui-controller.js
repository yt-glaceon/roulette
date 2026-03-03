import { RouletteWheel } from './animations/roulette-wheel.js';
import { SlotMachineAnimation } from './animations/slot-machine.js';
import { DrumRollAnimation } from './animations/drum-roll.js';
import { CardFlipAnimation } from './animations/card-flip.js';

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
            showResultsContainer: document.getElementById('show-results-container'),
            animationType: document.getElementById('animation-type'),
            animationDuration: document.getElementById('animation-duration'),
            durationValue: document.getElementById('duration-value')
        };

        this.currentMembers = [];
        this.currentSelectedMembers = [];
        this.rouletteWheel = null;
        
        // アニメーション方式のlocalStorageキー
        this.ANIMATION_TYPE_KEY = 'roulette_animation_type';
        this.ANIMATION_DURATION_KEY = 'roulette_animation_duration';
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
            
            // ロール入力フィールドを表示状態に戻す
            const roleContainer = document.getElementById('role-input-container');
            if (roleContainer) roleContainer.style.display = '';

            // メンバーリストをクリア
            this.elements.memberList.innerHTML = '';

            if (members.length === 0) {
                this.elements.memberList.innerHTML = '<p>メンバーがいません</p>';
                return;
            }

            // 選出人数の最大値を設定
            this.elements.selectCount.max = members.length;
            this.elements.selectCount.value = Math.min(1, members.length);
            
            // アニメーション方式を復元
            if (this.elements.animationType) {
                const savedType = this.loadAnimationType();
                this.elements.animationType.value = savedType;
                
                // ドロップダウン変更時のイベントリスナーを設定
                this.elements.animationType.addEventListener('change', (e) => {
                    this.saveAnimationType(e.target.value);
                });
            }
            
            // アニメーション時間を復元
            if (this.elements.animationDuration && this.elements.durationValue) {
                const savedDuration = this.loadAnimationDuration();
                this.elements.animationDuration.value = savedDuration;
                this.elements.durationValue.textContent = savedDuration;
                
                // スライダー変更時のイベントリスナーを設定
                this.elements.animationDuration.addEventListener('input', (e) => {
                    const duration = parseInt(e.target.value);
                    this.elements.durationValue.textContent = duration;
                    this.saveAnimationDuration(duration);
                });
            }

            // メンバーカードを作成(除外チェックボックス付き)
            members.forEach(member => {
                const card = this.createMemberCardWithExclusion(member);
                this.elements.memberList.appendChild(card);
            });

            // 除外チェックボックスのイベントリスナーを設定
            // 注: AppController.setupEventListeners でもイベント委譲で設定されているが、
            // UIController 単体でのテスト可能性を保つため、ここでも設定
            this.setupExclusionListeners();

            // ロール入力フィールドを追加
            const existingRoleContainer = document.getElementById('role-input-container');
            if (existingRoleContainer) {
                existingRoleContainer.remove();
            }

            const selectCount = parseInt(this.elements.selectCount.value);
            const roleInputFields = this.createRoleInputFields(selectCount);
            
            // ルーレットコントロールの後に挿入
            const rouletteControls = document.querySelector('.roulette-controls');
            if (rouletteControls) {
                rouletteControls.insertAdjacentElement('afterend', roleInputFields);
            }

            // 選出人数変更時のイベントリスナーを追加
            // 注: AppController.setupEventListeners でもイベント委譲で設定されているが、
            // UIController 単体でのテスト可能性を保つため、ここでも設定
            this.elements.selectCount.addEventListener('input', (e) => {
                const newCount = parseInt(e.target.value);
                this.updateRoleInputFields(newCount);
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
     * 除外チェックボックス付きメンバーカードを作成
     * @param {Object} member - メンバー情報
     * @returns {HTMLElement} メンバーカード
     */
    createMemberCardWithExclusion(member) {
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

        // 除外チェックボックスを追加
        const excludeContainer = document.createElement('div');
        excludeContainer.className = 'member-exclude';

        const excludeCheckbox = document.createElement('input');
        excludeCheckbox.type = 'checkbox';
        excludeCheckbox.id = `exclude-${member.id}`;
        excludeCheckbox.className = 'exclude-checkbox';
        excludeCheckbox.dataset.memberId = member.id;

        const excludeLabel = document.createElement('label');
        excludeLabel.htmlFor = `exclude-${member.id}`;
        excludeLabel.textContent = '除外';

        excludeContainer.appendChild(excludeCheckbox);
        excludeContainer.appendChild(excludeLabel);

        card.appendChild(avatar);
        card.appendChild(name);
        card.appendChild(excludeContainer);

        return card;
    }
    /**
     * 除外されたメンバーIDのリストを取得
     * @returns {Array<string>} 除外メンバーIDの配列
     */
    getExcludedMemberIds() {
        const excludedIds = [];
        const checkboxes = document.querySelectorAll('.exclude-checkbox:checked');
        checkboxes.forEach(checkbox => {
            excludedIds.push(checkbox.dataset.memberId);
        });
        return excludedIds;
    }
    /**
     * 除外チェックボックスのイベントリスナーを設定
     */
    setupExclusionListeners() {
        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateAvailableMemberCount();
            });
        });
    }

    /**
     * 選出可能なメンバー数を更新
     */
    updateAvailableMemberCount() {
        const excludedIds = this.getExcludedMemberIds();
        const availableCount = this.currentMembers.length - excludedIds.length;

        // 選出人数の上限を更新
        this.elements.selectCount.max = availableCount;

        // 現在の選出人数が上限を超えている場合は調整
        const currentValue = parseInt(this.elements.selectCount.value);
        const startButton = document.getElementById('start-roulette');
        
        if (currentValue > availableCount && availableCount > 0) {
            this.elements.selectCount.value = availableCount;
            this.showError(`選出人数が多すぎます。選出可能なメンバーは${availableCount}人です。`);
            // エラーメッセージを3秒後に自動的に非表示
            setTimeout(() => this.hideError(), 3000);
        }

        // すべてのメンバーが除外された場合のエラー表示
        if (availableCount === 0) {
            this.showError('選出できるメンバーがいません。除外を解除してください。');
            if (startButton) {
                startButton.disabled = true;
            }
            this.elements.selectCount.value = 0;
        } else {
            // 選出人数が上限を超えていない場合のみエラーを非表示
            if (currentValue <= availableCount) {
                this.hideError();
            }
            if (startButton) {
                startButton.disabled = false;
            }
            // 選出人数が0の場合は1に設定
            if (parseInt(this.elements.selectCount.value) === 0) {
                this.elements.selectCount.value = 1;
            }
        }
    }

    /**
     * ロール入力フィールドを作成
     * @param {number} count - 選出人数
     * @returns {HTMLElement} ロール入力コンテナ
     */
    createRoleInputFields(count) {
        const container = document.createElement('div');
        container.id = 'role-input-container';
        container.className = 'role-input-container';

        const label = document.createElement('label');
        label.textContent = 'ロール（任意）:';
        label.className = 'role-input-label';
        container.appendChild(label);

        const fieldsWrapper = document.createElement('div');
        fieldsWrapper.id = 'role-input-fields';
        fieldsWrapper.className = 'role-input-fields';

        for (let i = 0; i < count; i++) {
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'role-input-wrapper';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'role-input';
            input.placeholder = `ロール ${i + 1}`;
            input.dataset.index = i;

            inputWrapper.appendChild(input);
            fieldsWrapper.appendChild(inputWrapper);
        }

        container.appendChild(fieldsWrapper);
        return container;
    }

    /**
     * 入力されたロールのリストを取得
     * @returns {Array<string>} ロールの配列（空文字列は除外）
     */
    getRoles() {
        const roles = [];
        const inputs = document.querySelectorAll('.role-input');
        inputs.forEach(input => {
            const value = input.value.trim();
            if (value !== '') {
                roles.push(value);
            }
        });
        return roles;
    }
    /**
     * ロール入力フィールドを更新
     * @param {number} count - 新しい選出人数
     */
    updateRoleInputFields(count) {
        const fieldsWrapper = document.getElementById('role-input-fields');
        if (!fieldsWrapper) {
            return;
        }

        const currentInputs = fieldsWrapper.querySelectorAll('.role-input-wrapper');
        const currentCount = currentInputs.length;

        if (count > currentCount) {
            // フィールドを追加
            for (let i = currentCount; i < count; i++) {
                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'role-input-wrapper';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'role-input';
                input.placeholder = `ロール ${i + 1}`;
                input.dataset.index = i;

                inputWrapper.appendChild(input);
                fieldsWrapper.appendChild(inputWrapper);
            }
        } else if (count < currentCount) {
            // フィールドを削除（後ろから削除）
            for (let i = currentCount - 1; i >= count; i--) {
                const wrapper = currentInputs[i];
                wrapper.remove();
            }
        }
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
            selectedMembers.forEach((item, index) => {
                // item が {member, role} の形式か、単純な member オブジェクトかを判定
                const member = item.member || item;
                const role = item.role || null;
                const card = this.createResultCard(member, index + 1, role);
                this.elements.resultList.appendChild(card);
            });
        }

    /**
     * 結果カードを作成
     * @param {Object} member - メンバー情報
     * @param {number} order - 選出順序
     * @returns {HTMLElement} 結果カード
     */
    /**
         * 結果カードを作成
         * @param {Object} member - メンバー情報
         * @param {number} order - 選出順序
         * @param {string|null} role - 割り当てられたロール
         * @returns {HTMLElement} 結果カード
         */
        createResultCard(member, order, role = null) {
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

            // ロールが指定されている場合は表示
            if (role) {
                const roleElement = document.createElement('div');
                roleElement.className = 'member-role';
                roleElement.textContent = role;
                card.appendChild(roleElement);
            }

            return card;
        }

    /**
     * ルーレットアニメーションを実行
     * @param {Array} members - 全メンバー（除外後）
     * @param {Array} selected - 選出されたメンバー
     * @returns {Promise<void>}
     */
    async animateRoulette(members, selected) {
        console.log('[UIController] アニメーション開始');
        console.log('ルーレット表示メンバー:', members.map(m => m.displayName).join(', '));
        console.log('選出されたメンバー:', selected.map(m => m.displayName).join(', '));
        if (this.currentSelectedMembers && this.currentSelectedMembers.length > 0) {
            console.log('保存された結果:', this.currentSelectedMembers.map(item => item.member ? item.member.displayName : item.displayName).join(', '));
        }
        
        // ルーレット画面を表示
        this.hideAllScreens();
        this.screens.roulette.classList.remove('hidden');
        
        // メンバーリストとコントロールを非表示
        this.elements.memberList.style.display = 'none';
        const controls = document.querySelector('.roulette-controls');
        if (controls) controls.style.display = 'none';
        
        // ロール入力フィールドを非表示
        const roleContainer = document.getElementById('role-input-container');
        if (roleContainer) roleContainer.style.display = 'none';
        
        // 結果を見るボタンを非表示（アニメーション中）
        if (this.elements.showResultsContainer) {
            this.elements.showResultsContainer.classList.add('hidden');
        }
        
        // 既存のアニメーションコンテナを削除
        let animationContainer = document.getElementById('roulette-wheel-container');
        if (animationContainer) {
            animationContainer.remove();
        }
        
        // アニメーション用のコンテナを作成
        animationContainer = document.createElement('div');
        animationContainer.id = 'roulette-wheel-container';
        animationContainer.style.display = 'flex';
        animationContainer.style.justifyContent = 'center';
        animationContainer.style.alignItems = 'center';
        animationContainer.style.padding = '20px';
        animationContainer.style.flexDirection = 'column';
        this.screens.roulette.querySelector('.container').insertBefore(
            animationContainer,
            this.elements.memberList
        );
        
        // アニメーション方式と時間を取得
        const animationType = this.loadAnimationType();
        const animationDuration = this.loadAnimationDuration() * 1000; // 秒をミリ秒に変換
        
        console.log(`[UIController] アニメーション方式: ${animationType}, 時間: ${animationDuration}ms`);
        
        // アニメーションクラスを選択してインスタンス化
        let animation;
        try {
            switch (animationType) {
                case 'slot':
                    animation = new SlotMachineAnimation(animationContainer);
                    break;
                case 'drum':
                    animation = new DrumRollAnimation(animationContainer);
                    break;
                case 'card':
                    animation = new CardFlipAnimation(animationContainer);
                    break;
                case 'wheel':
                default:
                    animation = new RouletteWheel(animationContainer);
                    break;
            }
            
            // アニメーションを初期化
            animation.initialize(members);
            
            // 各選出メンバーに対してアニメーションを実行
            for (let i = 0; i < selected.length; i++) {
                await animation.spin(selected[i], { duration: animationDuration });
                
                // 最後のスピン以外は待機
                if (i < selected.length - 1) {
                    await this.sleep(500);
                }
            }
            
            // アニメーションインスタンスを保存（クリーンアップ用）
            this.rouletteWheel = animation;
            
        } catch (error) {
            console.error('[UIController] アニメーション実行エラー:', error);
            // エラー時は円形ルーレットにフォールバック
            animation = new RouletteWheel(animationContainer);
            animation.initialize(members);
            
            for (let i = 0; i < selected.length; i++) {
                await animation.spin(selected[i], { duration: animationDuration });
                if (i < selected.length - 1) {
                    await this.sleep(500);
                }
            }
            
            this.rouletteWheel = animation;
        }
        
        // 最後のアニメーション終了後1秒待ってからボタンを表示
        await this.sleep(1000);
        
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
    
    /**
     * アニメーション方式をlocalStorageに保存
     * @param {string} type - アニメーション方式 ('wheel' | 'slot' | 'card' | 'drum')
     */
    saveAnimationType(type) {
        try {
            localStorage.setItem(this.ANIMATION_TYPE_KEY, type);
            console.log(`[UIController] アニメーション方式を保存: ${type}`);
        } catch (error) {
            console.error('[UIController] localStorage保存エラー:', error);
        }
    }
    
    /**
     * アニメーション方式をlocalStorageから読み込み
     * @returns {string} アニメーション方式（デフォルト: 'wheel'）
     */
    loadAnimationType() {
        try {
            const type = localStorage.getItem(this.ANIMATION_TYPE_KEY);
            // 値がない場合はデフォルトの'wheel'を返す
            const animationType = type || 'wheel';
            console.log(`[UIController] アニメーション方式を読み込み: ${animationType}`);
            return animationType;
        } catch (error) {
            console.error('[UIController] localStorage読み込みエラー:', error);
            return 'wheel'; // エラー時もデフォルト値を返す
        }
    }
    
    /**
     * アニメーション時間をlocalStorageに保存
     * @param {number} duration - アニメーション時間（秒）
     */
    saveAnimationDuration(duration) {
        try {
            localStorage.setItem(this.ANIMATION_DURATION_KEY, duration.toString());
            console.log(`[UIController] アニメーション時間を保存: ${duration}秒`);
        } catch (error) {
            console.error('[UIController] localStorage保存エラー:', error);
        }
    }
    
    /**
     * アニメーション時間をlocalStorageから読み込み
     * @returns {number} アニメーション時間（デフォルト: 6秒）
     */
    loadAnimationDuration() {
        try {
            const duration = localStorage.getItem(this.ANIMATION_DURATION_KEY);
            // 値がない場合はデフォルトの6秒を返す
            const animationDuration = duration ? parseInt(duration) : 6;
            console.log(`[UIController] アニメーション時間を読み込み: ${animationDuration}秒`);
            return animationDuration;
        } catch (error) {
            console.error('[UIController] localStorage読み込みエラー:', error);
            return 6; // エラー時もデフォルト値を返す
        }
    }
}
