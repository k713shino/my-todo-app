/**
 * 認証方法別ユーザーID変換ユーティリティ
 * 同一メールアドレスでも認証方法ごとに別ユーザーとして扱うためのヘルパー関数
 */

/**
 * NextAuth.jsで使用されるプレフィックス付きユーザーIDから実際のユーザーIDを抽出
 * @param prefixedUserId - プレフィックス付きユーザーID (例: "github_123", "google_abc", "email_xyz")
 * @returns 実際のユーザーID
 */
export function extractUserIdFromPrefixed(prefixedUserId: string): string {
  if (prefixedUserId.startsWith('github_')) {
    return prefixedUserId.substring(7) // "github_"を削除
  }
  if (prefixedUserId.startsWith('google_')) {
    return prefixedUserId.substring(7) // "google_"を削除  
  }
  if (prefixedUserId.startsWith('email_')) {
    return prefixedUserId.substring(6) // "email_"を削除
  }
  // プレフィックスがない場合はそのまま返す
  return prefixedUserId
}

/**
 * 認証方法を識別
 * @param prefixedUserId - プレフィックス付きユーザーID
 * @returns 認証方法
 */
export function getAuthMethodFromUserId(prefixedUserId: string): 'github' | 'google' | 'email' | 'unknown' {
  if (prefixedUserId.startsWith('github_')) return 'github'
  if (prefixedUserId.startsWith('google_')) return 'google'
  if (prefixedUserId.startsWith('email_')) return 'email'
  return 'unknown'
}

/**
 * 認証方法とIDからプレフィックス付きIDを生成
 * @param authMethod - 認証方法
 * @param userId - 実際のユーザーID
 * @returns プレフィックス付きユーザーID
 */
export function createPrefixedUserId(authMethod: 'github' | 'google' | 'email', userId: string): string {
  return `${authMethod}_${userId}`
}