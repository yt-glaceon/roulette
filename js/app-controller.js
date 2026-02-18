import { AuthModule } from './auth.js';
import { DiscordClient } from './discord-client.js';
import { RouletteEngine } from './roulette-engine.js';
import { UIController } from './ui-controller.js';
import { ResultManager } from './result-manager.js';

/**
 * アプリケーションコントローラー
 * アプリケーション全体のフローを制御
 */
class AppController {
    constructor() {
        this.auth = new AuthModule();
        this.ui = new UIController();
        this.rouletteEngine = new RouletteEngine();
        this.resultManager = new ResultManager();
        this.discordClient = null;
        
        this.currentGuildId = null;
        this.currentChannelId = null;
        this.currentMembers = [];
    }

    /**
     * アプリケーションを初期化
     */
    async initialize() {
        try {
            // イベントリスナーを設定
            this.setupEventListeners();

            // 認証状態を確認
            if (this.auth.isAuthenticated()) {
                const token = this.auth.getToken();
                this.discordClient = new DiscordClient(token);
                
                // ギルド選択画面を表示
                await this.loadGuilds();
            } else {
                // 認証画面を表示
                this.ui.showAuthScreen();
            }
        } catch (error) {
            console.error('[AppController] 初期化エラー:', error);
            this.ui.showError('アプリケーションの初期化に失敗しました。');
        }
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
        // 認証ボタン
        document.getElementById('auth-button')?.addEventListener('click', () => {
            this.startAuth();
        });

        // ログアウトボタン
        document.getElementById('logout-button')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // ギルド選択
        document.getElementById('guild-list')?.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const guildId = card.dataset.guildId;
                this.handleGuildSelection(guildId);
            }
        });

        // チャネル選択
        document.getElementById('channel-list')?.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const channelId = card.dataset.channelId;
                this.handleChannelSelection(channelId);
            }
        });

        // ルーレット開始
        document.getElementById('start-roulette')?.addEventListener('click', () => {
            const count = parseInt(document.getElementById('select-count').value);
            this.handleRouletteExecution(count);
        });

        // 結果コピー
        document.getElementById('copy-result')?.addEventListener('click', () => {
            this.handleCopyResult();
        });

        // もう一度ルーレット
        document.getElementById('new-roulette')?.addEventListener('click', () => {
            this.ui.showRouletteScreen(this.currentMembers);
        });

        // 戻るボタン
        document.getElementById('back-to-guilds')?.addEventListener('click', () => {
            this.loadGuilds();
        });

        document.getElementById('back-to-channels')?.addEventListener('click', () => {
            this.handleGuildSelection(this.currentGuildId);
        });

        // エラーメッセージを閉じる
        document.getElementById('error-close')?.addEventListener('click', () => {
            this.ui.hideError();
        });
    }

    /**
     * 認証フローを開始
     */
    startAuth() {
        try {
            this.auth.initiateAuth();
        } catch (error) {
            console.error('[AppController] 認証開始エラー:', error);
            this.ui.showError('認証の開始に失敗しました。');
        }
    }

    /**
     * ギルドリストを読み込み
     */
    async loadGuilds() {
        try {
            this.ui.showLoading(true);
            const guilds = await this.discordClient.getGuilds();
            this.ui.showLoading(false);
            this.ui.showGuildSelection(guilds);
        } catch (error) {
            this.ui.showLoading(false);
            console.error('[AppController] ギルド取得エラー:', error);
            this.handleApiError(error);
        }
    }

    /**
     * ギルド選択を処理
     * @param {string} guildId - 選択されたギルド ID
     */
    async handleGuildSelection(guildId) {
        try {
            this.currentGuildId = guildId;
            this.ui.showLoading(true);
            
            const channels = await this.discordClient.getChannels(guildId);
            
            this.ui.showLoading(false);
            this.ui.showChannelSelection(channels);
        } catch (error) {
            this.ui.showLoading(false);
            console.error('[AppController] チャネル取得エラー:', error);
            this.handleApiError(error);
        }
    }

    /**
     * チャネル選択を処理
     * @param {string} channelId - 選択されたチャネル ID
     */
    async handleChannelSelection(channelId) {
        try {
            this.currentChannelId = channelId;
            this.ui.showLoading(true);
            
            const members = await this.discordClient.getVoiceChannelMembers(
                this.currentGuildId,
                channelId
            );
            
            this.ui.showLoading(false);
            
            if (members.length === 0) {
                this.ui.showError('このボイスチャネルにメンバーがいません。');
                return;
            }
            
            this.currentMembers = members;
            this.ui.showRouletteScreen(members);
        } catch (error) {
            this.ui.showLoading(false);
            console.error('[AppController] メンバー取得エラー:', error);
            this.handleApiError(error);
        }
    }

    /**
     * ルーレット実行を処理
     * @param {number} count - 選出人数
     */
    async handleRouletteExecution(count) {
        try {
            // バリデーション
            if (!this.rouletteEngine.validateCount(count, this.currentMembers.length)) {
                this.ui.showError(
                    `選出人数は 1 以上 ${this.currentMembers.length} 以下で指定してください。`
                );
                return;
            }

            // ルーレット実行
            const selected = this.rouletteEngine.selectMembers(this.currentMembers, count);
            
            // アニメーション表示
            await this.ui.animateRoulette(this.currentMembers, selected);
            
            // 結果を表示
            this.ui.showResults(selected);
            
            // 履歴に保存
            this.resultManager.saveToHistory({
                guildId: this.currentGuildId,
                channelId: this.currentChannelId,
                totalMembers: this.currentMembers.length,
                selectedCount: count,
                selectedMembers: selected
            });
        } catch (error) {
            console.error('[AppController] ルーレット実行エラー:', error);
            this.ui.showError('ルーレットの実行に失敗しました。');
        }
    }

    /**
     * 結果のコピーを処理
     */
    async handleCopyResult() {
        try {
            const resultCards = document.querySelectorAll('.result-card');
            const selectedMembers = Array.from(resultCards).map(card => {
                const name = card.querySelector('.member-name').textContent;
                return { displayName: name };
            });

            const success = await this.resultManager.copyToClipboard(selectedMembers);
            
            if (success) {
                this.ui.showSuccess('結果をクリップボードにコピーしました！');
            } else {
                this.ui.showError('クリップボードへのコピーに失敗しました。');
            }
        } catch (error) {
            console.error('[AppController] コピーエラー:', error);
            this.ui.showError('クリップボードへのコピーに失敗しました。');
        }
    }

    /**
     * ログアウトを処理
     */
    handleLogout() {
        try {
            this.auth.logout();
            this.discordClient = null;
            this.currentGuildId = null;
            this.currentChannelId = null;
            this.currentMembers = [];
            this.ui.showAuthScreen();
        } catch (error) {
            console.error('[AppController] ログアウトエラー:', error);
            this.ui.showError('ログアウトに失敗しました。');
        }
    }

    /**
     * API エラーを処理
     * @param {Object} error - エラーオブジェクト
     */
    handleApiError(error) {
        if (error.type === 'AUTH_ERROR') {
            this.ui.showError('認証エラーが発生しました。再度ログインしてください。');
            this.handleLogout();
        } else if (error.type === 'RATE_LIMIT') {
            this.ui.showError(error.message);
        } else if (error.type === 'NETWORK_ERROR') {
            this.ui.showError('ネットワークエラーが発生しました。接続を確認してください。');
        } else if (error.type === 'PERMISSION_ERROR') {
            this.ui.showError('このリソースにアクセスする権限がありません。');
        } else {
            this.ui.showError('エラーが発生しました。もう一度お試しください。');
        }
    }
}

// アプリケーションを初期化
const app = new AppController();
app.initialize();
