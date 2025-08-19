/**
 * セキュリティユーティリティ
 * セキュリティヘッダーの設定とセキュリティ関連の機能を提供
 */

/**
 * 🛡️ セキュリティヘッダーを作成
 */
export function createSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
}

/**
 * CORS ヘッダーを作成
 */
export function createCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.vercel.app' 
      : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }
}

/**
 * セキュリティとCORSヘッダーを結合
 */
export function createSecureHeaders() {
  return {
    ...createSecurityHeaders(),
    ...createCorsHeaders()
  }
}