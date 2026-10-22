/**
 * CORS の許可オリジン判定の純粋関数
 */

/**
 * リクエストのオリジンを許可するか判定する
 * - Origin ヘッダが無い(undefined)ときは許可する。ヘルスチェック・curl などブラウザ以外の呼び出しで、
 *   CORS はブラウザにしか効かないため拒否しても守りにならない。API はアクセストークンで守る
 * - それ以外は allowedOrigins のどれかと完全一致するときだけ許可する(前方一致・大文字小文字の違い・末尾 `/` は許可しない)
 * @param {string | undefined} origin
 * @param {readonly string[]} allowedOrigins
 * @returns {boolean}
 */
export function isAllowedOrigin(origin, allowedOrigins) {
  if (origin === undefined) {
    return true;
  }
  return allowedOrigins.includes(origin);
}
