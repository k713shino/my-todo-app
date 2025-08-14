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
      console.log('削除対象ユーザーID:', userId)

      // トランザクションを使用してすべてのデータを削除
      await prisma.$transaction(async (tx) => {
        console.log('1. Todoを削除中...')
        const deletedTodos = await tx.todo.deleteMany({
          where: { userId }
        })
        console.log(`削除されたTodo: ${deletedTodos.count}件`)

        console.log('2. 保存された検索を削除中...')
        const deletedSavedSearches = await tx.savedSearch.deleteMany({
          where: { userId }
        })
        console.log(`削除された保存検索: ${deletedSavedSearches.count}件`)

        console.log('3. 検索履歴を削除中...')
        const deletedSearchHistory = await tx.searchHistory.deleteMany({
          where: { userId }
        })
        console.log(`削除された検索履歴: ${deletedSearchHistory.count}件`)

        console.log('4. セッションを削除中...')
        const deletedSessions = await tx.session.deleteMany({
          where: { userId }
        })
        console.log(`削除されたセッション: ${deletedSessions.count}件`)

        console.log('5. OAuth アカウントを削除中...')
        const deletedAccounts = await tx.account.deleteMany({
          where: { userId }
        })
        console.log(`削除されたアカウント: ${deletedAccounts.count}件`)

        console.log('6. ユーザーを削除中...')
        await tx.user.delete({
          where: { id: userId }
        })
        console.log('ユーザー削除完了')
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