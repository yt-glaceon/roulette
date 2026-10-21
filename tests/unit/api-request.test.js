/**
 * API リクエスト組み立て(buildApiRequest)のユニットテスト
 */
import { buildApiRequest } from '../../js/api-request.js';

describe('buildApiRequest', () => {
    const base = 'https://example.com';
    const path = '/api/voice-members';
    const token = 'secret-token-123';

    test('url は ${apiEndpoint}${endpoint} と一致し、トークンも token= も含まない', () => {
        const { url } = buildApiRequest(base, path, token);
        expect(url).toBe(`${base}${path}`);
        expect(url).not.toContain(token);
        expect(url).not.toContain('token=');
    });

    test('init.headers[x-access-token] がトークンになる', () => {
        const { init } = buildApiRequest(base, path, token);
        expect(init.headers['x-access-token']).toBe(token);
    });

    test('Content-Type が application/json になる', () => {
        const { init } = buildApiRequest(base, path, token);
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    test('options.headers を重ねられ、既定のヘッダも残る', () => {
        const { init } = buildApiRequest(base, path, token, {
            headers: { 'X-Custom': 'abc' }
        });
        expect(init.headers['X-Custom']).toBe('abc');
        expect(init.headers['x-access-token']).toBe(token);
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    test('method など他のキーが init に残る', () => {
        const { init } = buildApiRequest(base, path, token, {
            method: 'POST',
            body: '{"a":1}'
        });
        expect(init.method).toBe('POST');
        expect(init.body).toBe('{"a":1}');
    });
});
