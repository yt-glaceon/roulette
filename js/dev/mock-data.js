/**
 * 開発用モックデータ
 * 形は server/index.js のレスポンスに合わせる（変更時は両方を揃えること）
 * import.meta.env には依存しない（Jest で直接テストするため）
 */

export const MOCK_GUILD = {
    id: 'mock-guild',
    name: '【モック】開発用サーバー',
    icon: null
};

export const MOCK_COUNT_MIN = 1;
export const MOCK_COUNT_MAX = 100;

const BASE_NAMES = [
    'あおい', 'ゆうと', 'さくら', 'はると', 'みお', 'そうた', 'ひなた', 'れん',
    'めい', 'いつき', 'こはる', 'かいと', 'つむぎ', 'りく', 'ことは', 'ゆま',
    'たくみ', 'なぎさ', 'しょう', 'あかり'
];

const AVATAR_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac'];

const EDGE_NAMES = [
    'とても長い名前のメンバーとても長い名前のメンバーとても長い名前のメンバーとても長い名前のメンバー',
    '🎮ゲーム好きのユーザー',
    'user_name-with.symbols!#$%&()',
    '🍣🍣🍣',
    'A<B>&"C\'',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
];

/**
 * ?mock の値を人数に変換
 * @param {string|null} value - クエリ値
 * @returns {number|null} 範囲内の整数、それ以外は null
 */
export function parseMockCount(value) {
    if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
        return null;
    }
    const n = Number(value);
    return n >= MOCK_COUNT_MIN && n <= MOCK_COUNT_MAX ? n : null;
}

/**
 * 色付きの円と頭文字の SVG data URI を作成
 * @param {string} name - 表示名
 * @param {string} color - 背景色
 * @returns {string} data URI
 */
function createAvatar(name, color) {
    const initial = Array.from(name)[0]
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">` +
        `<circle cx="32" cy="32" r="32" fill="${color}"/>` +
        `<text x="32" y="42" font-size="28" text-anchor="middle" fill="#fff">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * モックメンバーを作成（決定的）
 * @param {number} count - 人数
 * @param {Object} options - オプション
 * @param {string} [options.channelKey] - id の接頭辞に使うキー
 * @param {string[]} [options.names] - 先頭から使う名前リスト
 * @param {boolean} [options.noAvatar] - true なら全員アバター無し
 * @returns {Array} メンバーリスト
 */
export function createMockMembers(count, { channelKey = 'default', names, noAvatar = false } = {}) {
    const members = [];
    for (let i = 0; i < count; i++) {
        let displayName;
        if (names && i < names.length) {
            displayName = names[i];
        } else {
            const base = BASE_NAMES[i % BASE_NAMES.length];
            const round = Math.floor(i / BASE_NAMES.length);
            displayName = round === 0 ? base : `${base}${round + 1}`;
        }
        // 3人に1人はアバター無し（頭文字表示の確認用）
        const hasAvatar = !noAvatar && i % 3 !== 2;
        members.push({
            id: `mock-${channelKey}-${i + 1}`,
            username: `mock_${channelKey}_${i + 1}`,
            displayName,
            avatar: hasAvatar ? createAvatar(displayName, AVATAR_COLORS[i % AVATAR_COLORS.length]) : null
        });
    }
    return members;
}

/**
 * モックチャネル定義を作成
 * @param {number|null} customCount - 指定人数チャネルの人数（null なら追加しない）
 * @returns {Array} チャネル定義 [{ id, name, position, members }]
 */
export function buildMockChannels(customCount) {
    const channels = [
        { id: 'mock-normal', name: '【モック】通常(8人)', position: 1, members: createMockMembers(8, { channelKey: 'normal' }) },
        { id: 'mock-large', name: '【モック】大人数(30人)', position: 2, members: createMockMembers(30, { channelKey: 'large' }) },
        {
            id: 'mock-edge',
            name: '【モック】長い名前・絵文字・アバター無し',
            position: 3,
            members: createMockMembers(EDGE_NAMES.length, { channelKey: 'edge', names: EDGE_NAMES, noAvatar: true })
        },
        { id: 'mock-single', name: '【モック】1人', position: 4, members: createMockMembers(1, { channelKey: 'single' }) },
        { id: 'mock-empty', name: '【モック】0人', position: 5, members: [] }
    ];

    if (typeof customCount === 'number') {
        channels.unshift({
            id: 'mock-custom',
            name: `【モック】指定人数(${customCount}人)`,
            position: 0,
            members: createMockMembers(customCount, { channelKey: 'custom' })
        });
    }

    return channels;
}
