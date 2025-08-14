import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export const dynamic = 'force-dynamic'

export async function DELETE() {
  await optimizeForLambda()
  
  return measureLambdaPerformance('DELETE /api/user/delete', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userId = session.user.id

      // トランザクションを使用してすべてのデータを削除
      await prisma.$transaction(async (tx) => {
        // 1. Todoを削除
        await tx.todo.deleteMany({
          where: { userId }
        })

        // 2. 保存された検索を削除
        await tx.savedSearch.deleteMany({
          where: { userId }
        })

        // 3. 検索履歴を削除
        await tx.searchHistory.deleteMany({
          where: { userId }
        })

        // 4. セッションを削除
        await tx.session.deleteMany({
          where: { userId }
        })

        // 5. OAuth アカウントを削除
        await tx.account.deleteMany({
          where: { userId }
        })

        // 6. ユーザーを削除
        await tx.user.delete({
          where: { id: userId }
        })
      })

      console.log('✅ User account completely deleted:', userId)

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully'
      })

    } catch (error) {
      console.error('❌ Account deletion error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}