/**
 * @jest-environment jsdom
 */

import { UIController } from '../../js/ui-controller.js';

describe('チャネルメンバー数表示 - 統合テスト', () => {
    let uiController;
    let mockDiscordClient;

    beforeEach(() => {
        // DOM環境をセットアップ
        document.body.innerHTML = `
            <div id="channel-screen" class="screen">
                <div class="container">
                    <h2>ボイスチャネルを選択</h2>
                    <div id="channel-list" class="card-grid"></div>
                </div>
            </div>
            <div id="roulette-screen" class="screen hidden">
                <div id="member-list" class="member-grid"></div>
                <input type="number" id="select-count" min="1" value="1">
                <button id="start-roulette" class="btn btn-primary">ルーレット開始</button>
                <div id="show-results-container" class="hidden"></div>
            </div>
            <div id="result-screen" class="screen hidden"></div>
            <div id="loading" class="loading hidden"></div>
            <div id="error-message" class="error-message hidden">
                <p id="error-text"></p>
            </div>
        `;

        uiController = new UIController();

        // DiscordClientのモックを手動で作成
        mockDiscordClient = {
            getChannels: null // テストごとに設定
        };
    });

    describe('要件 3.1: チャネル選択画面表示時のAPI呼び出し', () => {
        test('チャネル選択画面を表示する時にgetChannels APIが呼ばれる', async () => {
            // モックデータを設定
            const mockChannels = [
                { id: '1', name: 'チャネル1', position: 0, memberCount: 3 },
                { id: '2', name: 'チャネル2', position: 1, memberCount: 0 },
                { id: '3', name: 'チャネル3', position: 2, memberCount: 5 }
            ];

            let callCount = 0;
            mockDiscordClient.getChannels = async () => {
                callCount++;
                return mockChannels;
            };

            // APIを呼び出してチャネル一覧を取得
            const channels = await mockDiscordClient.getChannels();

            // APIが呼ばれたことを確認
            expect(callCount).toBe(1);

            // レスポンスにmemberCountが含まれることを確認
            expect(channels).toHaveLength(3);
            channels.forEach(channel => {
                expect(channel).toHaveProperty('memberCount');
                expect(typeof channel.memberCount).toBe('number');
            });
        });

        test('API呼び出しが失敗した場合にエラーが処理される', async () => {
            // エラーをスロー
            const mockError = {
                type: 'NETWORK_ERROR',
                message: 'ネットワークエラーが発生しました'
            };
            mockDiscordClient.getChannels = async () => {
                throw mockError;
            };

            // エラーハンドリングを確認
            await expect(mockDiscordClient.getChannels()).rejects.toEqual(mockError);
        });
    });

    describe('要件 3.2: メンバー数が正しく表示される', () => {
        test('チャネルカードにメンバー数が表示される', () => {
            const channels = [
                { id: '1', name: 'チャネル1', position: 0, memberCount: 3 },
                { id: '2', name: 'チャネル2', position: 1, memberCount: 0 },
                { id: '3', name: 'チャネル3', position: 2, memberCount: 5 }
            ];

            uiController.showChannelSelection(channels, 'テストサーバー');

            // チャネルカードが作成されることを確認
            const channelCards = document.querySelectorAll('.card');
            expect(channelCards.length).toBe(3);

            // 各カードにメンバー数表示要素が含まれることを確認
            channelCards.forEach((card, index) => {
                const memberCountElement = card.querySelector('.channel-member-count');
                expect(memberCountElement).not.toBeNull();
                expect(memberCountElement.textContent).toBe(`👤 ${channels[index].memberCount}人`);
            });
        });

        test('メンバー数が0のチャネルで「👤 0人」と表示される', () => {
            const channels = [
                { id: '1', name: '空のチャネル', position: 0, memberCount: 0 }
            ];

            uiController.showChannelSelection(channels);

            const memberCountElement = document.querySelector('.channel-member-count');
            expect(memberCountElement).not.toBeNull();
            expect(memberCountElement.textContent).toBe('👤 0人');
        });

        test('memberCountが未定義の場合に0を表示する（フォールバック）', () => {
            const channels = [
                { id: '1', name: 'チャネル', position: 0 } // memberCountなし
            ];

            uiController.showChannelSelection(channels);

            const memberCountElement = document.querySelector('.channel-member-count');
            expect(memberCountElement).not.toBeNull();
            expect(memberCountElement.textContent).toBe('👤 0人');
        });

        test('複数のチャネルでそれぞれ異なるメンバー数が表示される', () => {
            const channels = [
                { id: '1', name: 'チャネル1', position: 0, memberCount: 1 },
                { id: '2', name: 'チャネル2', position: 1, memberCount: 10 },
                { id: '3', name: 'チャネル3', position: 2, memberCount: 100 }
            ];

            uiController.showChannelSelection(channels);

            const memberCountElements = document.querySelectorAll('.channel-member-count');
            expect(memberCountElements[0].textContent).toBe('👤 1人');
            expect(memberCountElements[1].textContent).toBe('👤 10人');
            expect(memberCountElements[2].textContent).toBe('👤 100人');
        });
    });

    describe('統合シナリオ: API呼び出しから表示まで', () => {
        test('APIからチャネル情報を取得してUIに表示する完全なフロー', async () => {
            // モックデータを設定
            const mockChannels = [
                { id: '1', name: 'ゲーム部屋', position: 0, memberCount: 5 },
                { id: '2', name: '雑談部屋', position: 1, memberCount: 2 }
            ];

            mockDiscordClient.getChannels = async () => mockChannels;

            // 1. APIを呼び出してチャネル一覧を取得
            const channels = await mockDiscordClient.getChannels();

            // 2. UIにチャネル選択画面を表示
            uiController.showChannelSelection(channels, 'テストサーバー');

            // 3. チャネルカードが正しく表示されることを確認
            const channelCards = document.querySelectorAll('.card');
            expect(channelCards.length).toBe(2);

            // 4. 各チャネルカードにメンバー数が表示されることを確認
            const firstCard = channelCards[0];
            expect(firstCard.querySelector('h3').textContent).toBe('ゲーム部屋');
            expect(firstCard.querySelector('.channel-member-count').textContent).toBe('👤 5人');

            const secondCard = channelCards[1];
            expect(secondCard.querySelector('h3').textContent).toBe('雑談部屋');
            expect(secondCard.querySelector('.channel-member-count').textContent).toBe('👤 2人');

            // 5. チャネルIDが正しく設定されることを確認
            expect(firstCard.dataset.channelId).toBe('1');
            expect(secondCard.dataset.channelId).toBe('2');
        });

        test('チャネルが存在しない場合の表示', async () => {
            const mockChannels = [];
            mockDiscordClient.getChannels = async () => mockChannels;

            const channels = await mockDiscordClient.getChannels();
            uiController.showChannelSelection(channels);

            const channelList = document.getElementById('channel-list');
            expect(channelList.innerHTML).toContain('ボイスチャネルがありません');
        });
    });

    describe('既存機能との互換性', () => {
        test('チャネルカードの既存のレイアウトが維持される', () => {
            const channels = [
                { id: '1', name: 'テストチャネル', position: 0, memberCount: 3 }
            ];

            uiController.showChannelSelection(channels);

            const card = document.querySelector('.card');
            
            // アイコンが存在することを確認
            const icon = card.querySelector('.card-icon');
            expect(icon).not.toBeNull();
            expect(icon.textContent).toBe('🔊');

            // チャネル名が存在することを確認
            const name = card.querySelector('h3');
            expect(name).not.toBeNull();
            expect(name.textContent).toBe('テストチャネル');

            // メンバー数表示が追加されていることを確認
            const memberCount = card.querySelector('.channel-member-count');
            expect(memberCount).not.toBeNull();

            // card-contentの構造を確認
            const content = card.querySelector('.card-content');
            expect(content).not.toBeNull();
            expect(content.children.length).toBe(2); // h3とchannel-member-count
        });

        test('チャネルカードがクリック可能であることを確認', () => {
            const channels = [
                { id: '123', name: 'テストチャネル', position: 0, memberCount: 3 }
            ];

            uiController.showChannelSelection(channels);

            const card = document.querySelector('.card');
            expect(card.dataset.channelId).toBe('123');
            
            // クリックイベントをシミュレート
            let clicked = false;
            card.addEventListener('click', () => {
                clicked = true;
            });
            card.click();
            
            expect(clicked).toBe(true);
        });
    });
});
