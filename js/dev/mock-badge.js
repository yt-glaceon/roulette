/**
 * モックバッジ
 * 開発用モードで動作中であることを画面右上に表示する
 */

/** バッジ要素の id */
const BADGE_ID = 'mock-badge';

/**
 * モックモード表示用のバッジを画面右上に固定表示する
 * すでに表示済みの場合は何もしない（二重に呼ばれても1つだけ）
 * @param {Document} [doc=document] - 対象のドキュメント
 * @returns {HTMLElement} バッジ要素
 */
export function showMockBadge(doc = document) {
    const existing = doc.getElementById(BADGE_ID);
    if (existing) {
        return existing;
    }

    const badge = doc.createElement('div');
    badge.id = BADGE_ID;
    badge.textContent = 'MOCK MODE';
    badge.style.cssText = [
        'position: fixed',
        'top: 8px',
        'right: 8px',
        'z-index: 9999',
        'padding: 4px 10px',
        'border-radius: 4px',
        'background: #f59e0b',
        'color: #000',
        'font-size: 12px',
        'font-weight: bold',
        'pointer-events: none'
    ].join('; ');

    doc.body.appendChild(badge);
    return badge;
}
