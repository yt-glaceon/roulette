/**
 * @jest-environment jsdom
 */

import { UIController } from '../../js/ui-controller.js';

describe('UIController - 除外リスト機能', () => {
    let uiController;

    beforeEach(() => {
        // DOM環境をセットアップ
        document.body.innerHTML = `
            <div id="channel-screen" class="screen"></div>
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
    });

    test('除外チェックボックスが表示される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        expect(checkboxes.length).toBe(2);
    });

    test('除外チェックボックスをチェックすると選出可能人数が更新される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        expect(selectCount.max).toBe('3');

        // 1人を除外
        const checkbox = document.querySelector('.exclude-checkbox');
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));

        expect(selectCount.max).toBe('2');
    });

    test('すべてのメンバーが除外された場合、エラーが表示される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        // すべてのチェックボックスをチェック
        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        const errorMessage = document.getElementById('error-message');
        expect(errorMessage.classList.contains('hidden')).toBe(false);

        const errorText = document.getElementById('error-text');
        expect(errorText.textContent).toContain('選出できるメンバーがいません');
    });

    test('すべてのメンバーが除外された場合、ルーレット開始ボタンが無効化される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const startButton = document.getElementById('start-roulette');
        expect(startButton.disabled).toBe(false);

        // すべてのチェックボックスをチェック
        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        });

        expect(startButton.disabled).toBe(true);
    });

    test('選出人数が選出可能なメンバー数を超える場合、自動的に調整される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        selectCount.value = 3;

        // 2人を除外
        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        checkboxes[0].checked = true;
        checkboxes[0].dispatchEvent(new Event('change'));
        checkboxes[1].checked = true;
        checkboxes[1].dispatchEvent(new Event('change'));

        expect(selectCount.value).toBe('1');
        expect(selectCount.max).toBe('1');
    });

    test('選出人数が選出可能なメンバー数を超える場合、エラーメッセージが表示される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        selectCount.value = 3;

        // 2人を除外（選出可能は1人）
        const checkboxes = document.querySelectorAll('.exclude-checkbox');
        checkboxes[0].checked = true;
        checkboxes[0].dispatchEvent(new Event('change'));
        checkboxes[1].checked = true;
        checkboxes[1].dispatchEvent(new Event('change'));

        const errorMessage = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        expect(errorMessage.classList.contains('hidden')).toBe(false);
        expect(errorText.textContent).toContain('選出人数が多すぎます');
        expect(errorText.textContent).toContain('1人です');
    });

    test('除外を解除すると選出可能人数が増える', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        const checkbox = document.querySelector('.exclude-checkbox');

        // 除外
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
        expect(selectCount.max).toBe('1');

        // 除外を解除
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
        expect(selectCount.max).toBe('2');

        const startButton = document.getElementById('start-roulette');
        expect(startButton.disabled).toBe(false);
    });
});

describe('UIController - ロール入力フィールド機能', () => {
    let uiController;

    beforeEach(() => {
        // DOM環境をセットアップ
        document.body.innerHTML = `
            <div id="channel-screen" class="screen"></div>
            <div id="roulette-screen" class="screen hidden">
                <div id="member-list" class="member-grid"></div>
                <div class="roulette-controls">
                    <input type="number" id="select-count" min="1" value="1">
                    <button id="start-roulette" class="btn btn-primary">ルーレット開始</button>
                </div>
                <div id="show-results-container" class="hidden"></div>
            </div>
            <div id="result-screen" class="screen hidden"></div>
            <div id="loading" class="loading hidden"></div>
            <div id="error-message" class="error-message hidden">
                <p id="error-text"></p>
            </div>
        `;

        uiController = new UIController();
    });

    test('ロール入力フィールドが選出人数に応じて表示される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const roleInputs = document.querySelectorAll('.role-input');
        expect(roleInputs.length).toBe(1); // 初期値は1
    });

    test('選出人数を増やすとロール入力フィールドが追加される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        selectCount.value = 3;
        selectCount.dispatchEvent(new Event('input'));

        const roleInputs = document.querySelectorAll('.role-input');
        expect(roleInputs.length).toBe(3);
    });

    test('選出人数を減らすとロール入力フィールドが削除される', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        
        // まず3に増やす
        selectCount.value = 3;
        selectCount.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.role-input').length).toBe(3);

        // 2に減らす
        selectCount.value = 2;
        selectCount.dispatchEvent(new Event('input'));
        expect(document.querySelectorAll('.role-input').length).toBe(2);
    });

    test('選出人数を減らすと非表示になったフィールドの内容がリセットされる', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        
        // 3に増やす
        selectCount.value = 3;
        selectCount.dispatchEvent(new Event('input'));

        // 各フィールドに値を入力
        const roleInputs = document.querySelectorAll('.role-input');
        roleInputs[0].value = 'リーダー';
        roleInputs[1].value = 'サポート';
        roleInputs[2].value = 'アタッカー';

        // 2に減らす（3番目のフィールドが削除される）
        selectCount.value = 2;
        selectCount.dispatchEvent(new Event('input'));

        // 再度3に増やす
        selectCount.value = 3;
        selectCount.dispatchEvent(new Event('input'));

        const newRoleInputs = document.querySelectorAll('.role-input');
        expect(newRoleInputs.length).toBe(3);
        expect(newRoleInputs[0].value).toBe('リーダー'); // 残っているフィールドは保持
        expect(newRoleInputs[1].value).toBe('サポート'); // 残っているフィールドは保持
        expect(newRoleInputs[2].value).toBe(''); // 新しく追加されたフィールドは空
    });

    test('getRoles メソッドが空文字列を除外してロールを取得する', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null },
            { id: '3', displayName: 'テスト次郎', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        const selectCount = document.getElementById('select-count');
        selectCount.value = 3;
        selectCount.dispatchEvent(new Event('input'));

        const roleInputs = document.querySelectorAll('.role-input');
        roleInputs[0].value = 'リーダー';
        roleInputs[1].value = ''; // 空文字列
        roleInputs[2].value = 'アタッカー';

        const roles = uiController.getRoles();
        expect(roles).toEqual(['リーダー', 'アタッカー']);
    });

    test('updateRoleInputFields メソッドが直接呼び出せる', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showRouletteScreen(members);

        // 直接メソッドを呼び出してフィールドを更新
        uiController.updateRoleInputFields(2);

        const roleInputs = document.querySelectorAll('.role-input');
        expect(roleInputs.length).toBe(2);
    });
});

describe('UIController - ロール付き結果表示機能', () => {
    let uiController;

    beforeEach(() => {
        // DOM環境をセットアップ
        document.body.innerHTML = `
            <div id="channel-screen" class="screen"></div>
            <div id="roulette-screen" class="screen hidden">
                <div id="member-list" class="member-grid"></div>
                <input type="number" id="select-count" min="1" value="1">
                <button id="start-roulette" class="btn btn-primary">ルーレット開始</button>
                <div id="show-results-container" class="hidden"></div>
            </div>
            <div id="result-screen" class="screen hidden">
                <div id="result-list"></div>
            </div>
            <div id="loading" class="loading hidden"></div>
            <div id="error-message" class="error-message hidden">
                <p id="error-text"></p>
            </div>
        `;

        uiController = new UIController();
    });

    test('ロールなしで結果が表示される（後方互換性）', () => {
        const members = [
            { id: '1', displayName: 'テスト太郎', avatar: null },
            { id: '2', displayName: 'テスト花子', avatar: null }
        ];

        uiController.showResults(members);

        const resultCards = document.querySelectorAll('.result-card');
        expect(resultCards.length).toBe(2);

        // ロール要素が存在しないことを確認
        const roleElements = document.querySelectorAll('.member-role');
        expect(roleElements.length).toBe(0);
    });

    test('ロール付きで結果が表示される', () => {
        const membersWithRoles = [
            { member: { id: '1', displayName: 'テスト太郎', avatar: null }, role: 'リーダー' },
            { member: { id: '2', displayName: 'テスト花子', avatar: null }, role: 'サポート' }
        ];

        uiController.showResults(membersWithRoles);

        const resultCards = document.querySelectorAll('.result-card');
        expect(resultCards.length).toBe(2);

        // ロール要素が存在することを確認
        const roleElements = document.querySelectorAll('.member-role');
        expect(roleElements.length).toBe(2);
        expect(roleElements[0].textContent).toBe('リーダー');
        expect(roleElements[1].textContent).toBe('サポート');
    });

    test('一部のメンバーのみロールが割り当てられている場合', () => {
        const membersWithRoles = [
            { member: { id: '1', displayName: 'テスト太郎', avatar: null }, role: 'リーダー' },
            { member: { id: '2', displayName: 'テスト花子', avatar: null }, role: null },
            { member: { id: '3', displayName: 'テスト次郎', avatar: null }, role: 'アタッカー' }
        ];

        uiController.showResults(membersWithRoles);

        const resultCards = document.querySelectorAll('.result-card');
        expect(resultCards.length).toBe(3);

        // ロール要素は2つだけ存在することを確認
        const roleElements = document.querySelectorAll('.member-role');
        expect(roleElements.length).toBe(2);
        expect(roleElements[0].textContent).toBe('リーダー');
        expect(roleElements[1].textContent).toBe('アタッカー');
    });

    test('createResultCard メソッドがロールパラメータを受け取る', () => {
        const member = { id: '1', displayName: 'テスト太郎', avatar: null };
        const card = uiController.createResultCard(member, 1, 'リーダー');

        expect(card.className).toBe('result-card');
        
        const roleElement = card.querySelector('.member-role');
        expect(roleElement).not.toBeNull();
        expect(roleElement.textContent).toBe('リーダー');
    });

    test('createResultCard メソッドがロールなしで動作する', () => {
        const member = { id: '1', displayName: 'テスト太郎', avatar: null };
        const card = uiController.createResultCard(member, 1);

        expect(card.className).toBe('result-card');
        
        const roleElement = card.querySelector('.member-role');
        expect(roleElement).toBeNull();
    });
});
