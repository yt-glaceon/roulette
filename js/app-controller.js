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
        this.ui = new UIController();
        this.rouletteEngine = new RouletteEngine();
        this.resultManager = new ResultManager();
        this.discordClient = null;
        
        this.accessToken = null;
        this.currentGuildId = null;
        this.currentChannelId = null;
        this.currentMembers = [];
    }

    /**
     * アプリケーションを初期化
     */
    async initialize() {
        try {
            // URL パラメータからトークンを取得
            const params = new URLSearchParams(window.location.search);
            this.accessToken = params.get('token');

            if (!this.accessToken) {
                this.ui.showError(
                    'アクセストークンが必要です。\n' +
                    'Discord で /roulette コマンドを実行して URL を取得してください。'
                );
                return;
            }

            // Discord クライアントを初期化（トークン付き）
            this.discordClient = new DiscordClient(this.accessToken);

            // トークンを検証
            const validation = await this.discordClient.validateToken();
            if (!validation.valid) {
                this.ui.showError('無効なトークンです。新しい URL を取得してください。');
                return;
            }

            this.currentGuildId = validation.guildId;

            // イベントリスナーを設定
            this.setupEventListeners();

            // ギルド情報を取得してチャネル選択画面を表示
            await this.loadGuildAndChannels();
        } catch (error) {
            console.error('[AppController] 初期化エラー:', error);
            if (error.type === 'NETWORK_ERROR') {
                this.ui.showError('バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。');
            } else {
                this.ui.showError(error.message || 'アプリケーションの初期化に失敗しました。');
            }
        }
    }

    /**
     * イベントリスナーを設定
     */
    setupEventListeners() {
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

        // 結果を見る
        document.getElementById('show-results')?.addEventListener('click', () => {
            this.ui.showSavedResults();
        });

        // 結果コピー
        document.getElementById('copy-result')?.addEventListener('click', () => {
            this.handleCopyResult();
        });

        // もう一度ルーレット
        document.getElementById('new-roulette')?.addEventListener('click', () => {
            this.ui.showRouletteScreen(this.currentMembers);
        });

        // TOPに戻る
        document.getElementById('back-to-top')?.addEventListener('click', () => {
            this.loadGuildAndChannels();
        });

        // 戻るボタン
        document.getElementById('back-to-channels')?.addEventListener('click', () => {
            this.loadGuildAndChannels();
        });

        // エラーメッセージを閉じる
        document.getElementById('error-close')?.addEventListener('click', () => {
            this.ui.hideError();
        });
    }

    /**
     * ギルド情報とチャネルリストを読み込み
     */
    async loadGuildAndChannels() {
        try {
            this.ui.showLoading(true);
            
            // ギルド情報を取得
            const guild = await this.discordClient.getGuild();
            
            // チャネルリストを取得
            const channels = await this.discordClient.getChannels();
            
            this.ui.showLoading(false);
            this.ui.showChannelSelection(channels, guild.name);
        } catch (error) {
            this.ui.showLoading(false);
            console.error('[AppController] ギルド/チャネル取得エラー:', error);
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
            
            const members = await this.discordClient.getVoiceChannelMembers(channelId);
            
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

            // 結果を見るボタンを非表示
            const showResultsContainer = document.getElementById('show-results-container');
            if (showResultsContainer) {
                showResultsContainer.classList.add('hidden');
            }

            // ルーレット実行
            const selected = this.rouletteEngine.selectMembers(this.currentMembers, count);
            
            // アニメーション表示（ルーレット画面に留まり、結果を見るボタンを表示）
            await this.ui.animateRoulette(this.currentMembers, selected);
            
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
     * API エラーを処理
     * @param {Object} error - エラーオブジェクト
     */
    handleApiError(error) {
        if (error.type === 'NETWORK_ERROR') {
            this.ui.showError('バックエンドサーバーに接続できません。サーバーが起動しているか確認してください。');
        } else if (error.type === 'NOT_FOUND') {
            this.ui.showError('リソースが見つかりません。');
        } else if (error.type === 'SERVER_ERROR') {
            this.ui.showError('サーバーエラーが発生しました。もう一度お試しください。');
        } else if (error.status === 401) {
            this.ui.showError('トークンが無効または期限切れです。Discord で /roulette コマンドを実行して新しい URL を取得してください。');
        } else {
            this.ui.showError(error.message || 'エラーが発生しました。もう一度お試しください。');
        }
    }
}

// アプリケーションを初期化
const app = new AppController();
app.initialize();
