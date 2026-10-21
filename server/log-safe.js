/**
 * ログに機密値（アクセストークン・インタラクショントークン）が出ないようにする純粋関数群
 */

/**
 * トークンを先頭6文字 + `…` に伏せる
 * 短い値や文字列でない値は全文が出ないよう `***` にする
 * @param {unknown} token
 * @returns {string}
 */
export function maskToken(token) {
  if (typeof token === 'string' && token.length >= 12) {
    return `${token.slice(0, 6)}…`;
  }
  return '***';
}

/**
 * URL 中のトークンを伏せる
 * - パスの /interactions/<id>/<token>・/webhooks/<id>/<token> の <token> を `***` にする
 * - クエリの token=<値> の値を maskToken で伏せる
 * @param {unknown} url
 * @returns {unknown} 文字列でなければそのまま返す
 */
export function maskUrl(url) {
  if (typeof url !== 'string') {
    return url;
  }
  return url
    .replace(/(\/(?:interactions|webhooks)\/[^/?#]+\/)[^/?#]+/g, '$1***')
    .replace(/([?&]token=)([^&#]*)/g, (_, prefix, value) => `${prefix}${maskToken(value)}`);
}

/**
 * エラーをログ1件ぶんの機密値を含まない文字列にする
 * - url / requestBody を持つ（discord.js の DiscordAPIError・HTTPError）場合:
 *   name: message に code・status・method・url（伏せ済み）だけを付ける。requestBody とスタックは出さない
 * - それ以外の Error: スタック（無ければ name: message）
 * - Error でない値: String(error)
 * @param {unknown} error
 * @returns {string}
 */
export function describeError(error) {
  const isObject = typeof error === 'object' && error !== null;

  if (isObject && (error.url != null || error.requestBody != null)) {
    const details = [
      ['code', error.code],
      ['status', error.status],
      ['method', error.method],
      ['url', maskUrl(error.url)],
    ]
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => `${key}=${value}`);
    const head = `${error.name}: ${error.message}`;
    return details.length > 0 ? `${head} (${details.join(', ')})` : head;
  }

  if (error instanceof Error) {
    return error.stack || `${error.name}: ${error.message}`;
  }

  return String(error);
}
