/**
 * @jest-environment jsdom
 */

/**
 * モックバッジのユニットテスト
 */
import { showMockBadge } from '../../js/dev/mock-badge.js';

describe('showMockBadge', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('呼ぶと #mock-badge が1つ作られる', () => {
        showMockBadge();

        expect(document.querySelectorAll('#mock-badge')).toHaveLength(1);
    });

    test('2回呼んでも #mock-badge は1つのまま', () => {
        showMockBadge();
        showMockBadge();

        expect(document.querySelectorAll('#mock-badge')).toHaveLength(1);
    });
});
