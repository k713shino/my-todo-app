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

      console.log('🔍 認証方法API開始 - ユーザーID:', session.user.id)

      // ユーザーのアカウント情報を取得（エラーハンドリング付き）
      let accounts: Array<{provider: string, providerAccountId: string}> = []
      try {
        accounts = await prisma.account.findMany({
          where: { userId: session.user.id },
          select: {
            provider: true,
            providerAccountId: true
          }
        })
        console.log('✅ アカウント情報取得成功:', accounts.length, '件')
      } catch (accountError) {
        console.error('❌ アカウント情報取得エラー:', accountError)
        // エラーでも続行（空配列として扱う）
      }

      // ユーザー情報も取得（パスワード認証の判定のため）
      let user = null
      try {
        user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { password: true }
        })
        console.log('✅ ユーザー情報取得成功 - パスワード有無:', !!user?.password)
      } catch (userError) {
        console.error('❌ ユーザー情報取得エラー:', userError)
        // エラーでも続行
      }

      console.log('🔍 認証方法デバッグ:', {
        userId: session.user.id,
        hasPassword: !!user?.password,
        oauthAccounts: accounts,
        sessionHasPassword: session.user.hasPassword
      })

      // 認証方法を決定
      let authMethods: Array<{provider: string, providerAccountId: string}> = [...accounts]
      
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
      
      // エラーでもデフォルト認証方法を返す（アプリの動作を継続）
      return NextResponse.json({
        authMethods: [{
          provider: 'credentials',
          providerAccountId: 'email'
        }]
      })
    }
  })
}