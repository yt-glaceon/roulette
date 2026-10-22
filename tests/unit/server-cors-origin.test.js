/**
 * server/cors-origin のユニットテスト
 */
import fc from 'fast-check';
import { isAllowedOrigin } from '../../server/cors-origin.js';

const ALLOWED = [
    'https://yt-glaceon.github.io',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];

describe('isAllowedOrigin', () => {
    test.each(ALLOWED)('許可リストのオリジン %s は許可する', (origin) => {
        expect(isAllowedOrigin(origin, ALLOWED)).toBe(true);
    });

    test('Origin ヘッダ無し（undefined）は許可する', () => {
        expect(isAllowedOrigin(undefined, ALLOWED)).toBe(true);
    });

    test.each([
        'https://yt-glaceon.github.io.attacker.example',
        'http://localhost:55000',
        'http://localhost:5500.evil.example',
        'http://127.0.0.1:55001'
    ])('前方一致で通っていた %s は拒否する', (origin) => {
        expect(isAllowedOrigin(origin, ALLOWED)).toBe(false);
    });

    test.each([
        'https://yt-glaceon.github.io/',
        'https://YT-GLACEON.github.io',
        'http://yt-glaceon.github.io',
        'https://yt-glaceon.github.io:443'
    ])('表記違いの %s は拒否する', (origin) => {
        expect(isAllowedOrigin(origin, ALLOWED)).toBe(false);
    });

    test.each([
        ['文字列の null', 'null'],
        ['空文字', ''],
        ['許可リスト外', 'https://example.com'],
        ['文字列以外の null', null],
        ['数値', 123]
    ])('%s は拒否する', (_label, origin) => {
        expect(isAllowedOrigin(origin, ALLOWED)).toBe(false);
    });

    test('別の許可リストを渡せる', () => {
        const list = ['https://a.example'];
        expect(isAllowedOrigin('https://a.example', list)).toBe(true);
        expect(isAllowedOrigin('https://yt-glaceon.github.io', list)).toBe(false);
    });

    test('空の許可リストでは Origin 無し以外すべて拒否する', () => {
        expect(isAllowedOrigin(undefined, [])).toBe(true);
        expect(isAllowedOrigin('https://yt-glaceon.github.io', [])).toBe(false);
        expect(isAllowedOrigin('', [])).toBe(false);
    });

    test('許可リストのどれかに1文字以上を後ろに付けたものは常に拒否する', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...ALLOWED),
                fc.string({ minLength: 1 }),
                (base, suffix) => {
                    const origin = base + suffix;
                    fc.pre(!ALLOWED.includes(origin));
                    expect(isAllowedOrigin(origin, ALLOWED)).toBe(false);
                }
            )
        );
    });
});
