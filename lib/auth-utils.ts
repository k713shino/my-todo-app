import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

// 🛡️ セキュリティ強化: セッション検証ユーティリティ
export interface AuthenticatedUser {
  id: string
  email: string
  name?: string | null
  image?: string | null
  hasPassword?: boolean
}

export interface AuthValidationResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
}

/**
 * 🛡️ 厳格なセッション検証
 * APIルートで使用する認証済みユーザー情報を取得
 */
export async function getAuthenticatedUser(_request?: NextRequest): Promise<AuthValidationResult> {
  try {
    // NextAuth セッションを取得
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log('❌ セッションが存在しません')
      return {
        success: false,
        error: 'UNAUTHORIZED'
      }
    }

    if (!session.user) {
      console.log('❌ セッションにユーザー情報がありません')
      return {
        success: false,
        error: 'INVALID_SESSION'
      }
    }

    // 🛡️ セキュリティ修正: 必須フィールドの検証
    if (!session.user.id || !session.user.email) {
      console.log('❌ ユーザーIDまたはメールアドレスが不正です')
      return {
        success: false,
        error: 'INVALID_USER_DATA'
      }
    }

    // 🛡️ セキュリティ修正: IDの形式検証（OAuth対応）
    if (!isValidUserId(session.user.id)) {
      console.log('❌ 不正なユーザーID形式:', session.user.id)
      return {
        success: false,
        error: 'INVALID_USER_ID'
      }
    }

    // 🛡️ セキュリティ修正: メールアドレス形式の検証
    if (!isValidEmail(session.user.email)) {
      console.log('❌ 不正なメールアドレス形式:', session.user.email)
      return {
        success: false,
        error: 'INVALID_EMAIL'
      }
    }

    console.log('✅ セッション検証成功:', {
      userId: session.user.id,
      email: session.user.email
    })

    return {
      success: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        hasPassword: session.user.hasPassword
      }
    }
  } catch (error) {
    console.error('🚨 セッション検証エラー:', error)
    return {
      success: false,
      error: 'SESSION_VALIDATION_ERROR'
    }
  }
}

/**
 * 🛡️ ユーザーID形式の検証（OAuth対応）
 */
function isValidUserId(id: string): boolean {
  // CUID形式: 小文字 + 数字、25文字
  const cuidPattern = /^c[a-z0-9]{24}$/
  // GitHub ID形式: 数字のみ
  const githubIdPattern = /^\d+$/
  // Google ID形式: 数字21桁
  const googleIdPattern = /^\d{21}$/
  // その他の一般的なID形式: 英数字とハイフン、アンダースコア
  const generalIdPattern = /^[a-zA-Z0-9_-]{1,255}$/
  
  return cuidPattern.test(id) || 
         githubIdPattern.test(id) || 
         googleIdPattern.test(id) || 
         generalIdPattern.test(id)
}

/**
 * 🛡️ メールアドレス形式の検証
 */
function isValidEmail(email: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailPattern.test(email) && email.length <= 254
}

/**
 * 🛡️ API認証エラーレスポンスの生成
 */
export function createAuthErrorResponse(error: string, status: number = 401) {
  const errorMessages = {
    'UNAUTHORIZED': '認証が必要です',
    'INVALID_SESSION': 'セッションが無効です',
    'INVALID_USER_DATA': 'ユーザー情報が不正です',
    'INVALID_USER_ID': 'ユーザーIDが不正です',
    'INVALID_EMAIL': 'メールアドレスが不正です',
    'SESSION_VALIDATION_ERROR': 'セッション検証でエラーが発生しました'
  }
  
  return Response.json(
    {
      success: false,
      error: error,
      message: errorMessages[error as keyof typeof errorMessages] || '認証エラーが発生しました'
    },
    { status }
  )
}

/**
 * 🛡️ セキュリティ修正: リクエスト制限とレート制限の準備
 */
export function createSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  }
}