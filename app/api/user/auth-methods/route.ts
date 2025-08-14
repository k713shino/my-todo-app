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

      console.log('✅ Auth methods fetched successfully for user:', session.user.id)

      return NextResponse.json({
        authMethods: accounts
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