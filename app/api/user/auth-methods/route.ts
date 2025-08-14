import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export const dynamic = 'force-dynamic'

export async function GET() {
  await optimizeForLambda()
  
  return measureLambdaPerformance('GET /api/user/auth-methods', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // ユーザーのアカウント情報を取得
      const accounts = await prisma.account.findMany({
        where: { userId: session.user.id },
        select: {
          provider: true,
          providerAccountId: true
        }
      })

      // ユーザー情報も取得（パスワード認証の判定のため）
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true }
      })

      console.log('🔍 認証方法デバッグ:', {
        userId: session.user.id,
        hasPassword: !!user?.password,
        oauthAccounts: accounts,
        sessionHasPassword: session.user.hasPassword
      })

      // 認証方法を決定
      let authMethods = [...accounts]
      
      // OAuthアカウントがある場合はそれらを優先し、Credentialsは除外
      if (accounts.length > 0) {
        authMethods = accounts.filter(acc => acc.provider !== 'credentials')
        console.log('🔗 OAuth認証アカウントを使用:', authMethods)
      } else if (user?.password) {
        // OAuthアカウントがなく、パスワードがある場合のみCredentials
        authMethods = [{
          provider: 'credentials',
          providerAccountId: 'email'
        }]
        console.log('📧 Credentials認証のみ')
      }

      console.log('✅ 最終認証方法:', authMethods)

      return NextResponse.json({
        authMethods
      })

    } catch (error) {
      console.error('❌ Auth methods fetch error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}