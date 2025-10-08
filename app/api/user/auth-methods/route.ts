import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'
import dbAdapter from '@/lib/db-adapter'

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

      // Lambda経由で認証方法を取得
      console.log('⏳ Getting auth methods via Lambda...')
      const authResult = await dbAdapter.getAuthMethods(session.user.id)
      
      if (!authResult.success) {
        console.error('❌ Auth methods fetch failed:', authResult.error)
        
        // 接続エラー時はデフォルト認証方法を返す
        return NextResponse.json({
          authMethods: [{
            provider: 'credentials',
            providerAccountId: 'email'
          }],
          maintenanceMode: true
        })
      }

      const authMethods = (authResult.data as { authMethods?: unknown[] })?.authMethods || [{
        provider: 'credentials',
        providerAccountId: 'email'
      }]

      console.log('✅ Lambda経由で認証方法取得成功:', authMethods)

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