/**
 * API リクエストの URL とヘッダを組み立てる
 * アクセストークンは URL に含めず、x-access-token ヘッダで送る
 * @param {string} apiEndpoint - API のベース URL
 * @param {string} endpoint - API エンドポイント
 * @param {string} accessToken - アクセストークン
 * @param {Object} options - fetch に渡すリクエストオプション
 * @returns {{url: string, init: Object}} fetch(url, init) に渡す値
 */
export function buildApiRequest(apiEndpoint, endpoint, accessToken, options = {}) {
    return {
        url: `${apiEndpoint}${endpoint}`,
        init: {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'x-access-token': accessToken,
                ...options.headers
            }
        }
    };
}
