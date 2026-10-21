/**
 * server/log-safe のユニットテスト
 */
import fc from 'fast-check';
import { maskToken, maskUrl, describeError } from '../../server/log-safe.js';

const HEX = '0123456789abcdef'.split('');
const hex64 = fc
    .array(fc.constantFrom(...HEX), { minLength: 64, maxLength: 64 })
    .map((chars) => chars.join(''));

const TOKEN64 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

describe('maskToken', () => {
    test('64桁の16進トークンは先頭6文字 + … になり全文を含まない', () => {
        expect(maskToken(TOKEN64)).toBe(`${TOKEN64.slice(0, 6)}…`);
        expect(maskToken(TOKEN64)).not.toContain(TOKEN64);
    });

    test('任意の64桁16進で全文を含まず長さが7', () => {
        fc.assert(
            fc.property(hex64, (token) => {
                const masked = maskToken(token);
                expect(masked).not.toContain(token);
                expect(masked).toHaveLength(7);
                expect(masked.startsWith(token.slice(0, 6))).toBe(true);
            })
        );
    });

    test('短い文字列・空文字・undefined・数値は *** になる', () => {
        expect(maskToken('abc')).toBe('***');
        expect(maskToken('12345678901')).toBe('***');
        expect(maskToken('')).toBe('***');
        expect(maskToken(undefined)).toBe('***');
        expect(maskToken(null)).toBe('***');
        expect(maskToken(123456789012345)).toBe('***');
    });
});

describe('maskUrl', () => {
    test('interactions パスのトークンを伏せる', () => {
        const url = 'https://discord.com/api/v10/interactions/123/abcTOKEN/callback';
        const masked = maskUrl(url);
        expect(masked).not.toContain('abcTOKEN');
        expect(masked).toBe('https://discord.com/api/v10/interactions/123/***/callback');
    });

    test('webhooks パスのトークンを伏せる', () => {
        const url = 'https://discord.com/api/v10/webhooks/123/abcTOKEN/messages/@original';
        const masked = maskUrl(url);
        expect(masked).not.toContain('abcTOKEN');
        expect(masked).toBe('https://discord.com/api/v10/webhooks/123/***/messages/@original');
    });

    test('クエリの token は先頭6文字だけ残る', () => {
        const masked = maskUrl(`https://example.com/?token=${TOKEN64}`);
        expect(masked).toBe(`https://example.com/?token=${TOKEN64.slice(0, 6)}…`);
        expect(masked).not.toContain(TOKEN64);
    });

    test('token が途中にあっても他のクエリは残る', () => {
        const masked = maskUrl(`https://example.com/?a=1&token=${TOKEN64}&b=2`);
        expect(masked).toBe(`https://example.com/?a=1&token=${TOKEN64.slice(0, 6)}…&b=2`);
        expect(masked).toContain('a=1');
        expect(masked).toContain('b=2');
        expect(masked).not.toContain(TOKEN64);
    });

    test('任意の64桁16進の token クエリで全文が残らない', () => {
        fc.assert(
            fc.property(hex64, (token) => {
                expect(maskUrl(`https://example.com/x?a=1&token=${token}&b=2`)).not.toContain(token);
            })
        );
    });

    test('トークンを含まない URL は変わらない', () => {
        const url = 'https://example.com/api/channels?a=1&b=2#hash';
        expect(maskUrl(url)).toBe(url);
    });

    test('文字列でない値はそのまま返る', () => {
        const obj = { a: 1 };
        expect(maskUrl(undefined)).toBeUndefined();
        expect(maskUrl(null)).toBeNull();
        expect(maskUrl(42)).toBe(42);
        expect(maskUrl(obj)).toBe(obj);
    });
});

describe('describeError', () => {
    const ACCESS_TOKEN = TOKEN64;
    const INTERACTION_TOKEN = 'SECRETinteractionTOKEN0123456789';

    const makeDiscordApiError = (overrides = {}) => {
        const error = new Error('Unknown interaction');
        error.name = 'DiscordAPIError[10062]';
        Object.assign(error, {
            code: 10062,
            status: 404,
            method: 'POST',
            url: `https://discord.com/api/v10/interactions/123456/${INTERACTION_TOKEN}/callback`,
            requestBody: {
                json: {
                    data: {
                        content: `https://example.com/?token=${ACCESS_TOKEN}`
                    }
                }
            },
            ...overrides
        });
        return error;
    };

    test('疑似 DiscordAPIError はトークン・requestBody を含まず code/status/method を含む', () => {
        const result = describeError(makeDiscordApiError());
        expect(result).not.toContain(ACCESS_TOKEN);
        expect(result).not.toContain(INTERACTION_TOKEN);
        expect(result).not.toContain('requestBody');
        expect(result).not.toContain('content');
        expect(result).toContain('Unknown interaction');
        expect(result).toContain('10062');
        expect(result).toContain('404');
        expect(result).toContain('POST');
        expect(result).toContain('/interactions/123456/***/callback');
    });

    test('スタックは出さない', () => {
        const error = makeDiscordApiError();
        error.stack = 'Error: x\n    at secretFrame (/app/file.js:1:1)';
        expect(describeError(error)).not.toContain('secretFrame');
    });

    test('status が 0 でも出力される', () => {
        const result = describeError(makeDiscordApiError({ status: 0 }));
        expect(result).toContain('status=0');
    });

    test('requestBody だけを持つ場合もスタックや本文を出さない', () => {
        const result = describeError(
            makeDiscordApiError({ url: undefined, code: undefined, status: undefined, method: undefined })
        );
        expect(result).not.toContain(ACCESS_TOKEN);
        expect(result).toContain('Unknown interaction');
    });

    test('普通の Error はスタックが返る', () => {
        const error = new Error('boom');
        expect(describeError(error)).toBe(error.stack);
    });

    test('スタックが無い Error は name: message が返る', () => {
        const error = new TypeError('boom');
        error.stack = undefined;
        expect(describeError(error)).toBe('TypeError: boom');
    });

    test('Error でない値は文字列化される', () => {
        expect(describeError('oops')).toBe('oops');
        expect(describeError(42)).toBe('42');
        expect(describeError(undefined)).toBe('undefined');
        expect(describeError(null)).toBe('null');
        expect(describeError({ toString: () => 'custom' })).toBe('custom');
    });
});
