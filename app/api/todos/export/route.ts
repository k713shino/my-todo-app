import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  await optimizeForLambda()
  
  return measureLambdaPerformance('GET /api/todos/export', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { searchParams } = new URL(request.url)
      const format = searchParams.get('format') || 'json'

      // ユーザーのTodoデータを取得
      const todos = await prisma.todo.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' }
      })

      console.log(`✅ Exporting ${todos.length} todos in ${format} format for user:`, session.user.id)

      if (format === 'csv') {
        // CSV形式でエクスポート
        const csvHeader = 'ID,タイトル,説明,完了状態,優先度,期限,カテゴリ,タグ,作成日,更新日\n'
        const csvRows = todos.map(todo => {
          const escapeCsv = (str: string | null) => {
            if (!str) return ''
            // CSVエスケープ: ダブルクォートを含む場合は全体をダブルクォートで囲み、内部のダブルクォートは2倍にする
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }

          return [
            todo.id,
            escapeCsv(todo.title),
            escapeCsv(todo.description),
            todo.status === 'DONE' ? '完了' : `${todo.status === 'TODO' ? '未着手' : todo.status === 'IN_PROGRESS' ? '作業中' : '確認中'}`,
            todo.priority,
            todo.dueDate ? new Date(todo.dueDate).toLocaleDateString('ja-JP') : '',
            escapeCsv(todo.category),
            Array.isArray(todo.tags) ? todo.tags.join(';') : '',
            new Date(todo.createdAt).toLocaleDateString('ja-JP'),
            new Date(todo.updatedAt).toLocaleDateString('ja-JP')
          ].join(',')
        }).join('\n')

        const csvData = csvHeader + csvRows

        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv;charset=utf-8',
            'Content-Disposition': `attachment; filename="todos-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })
      } else {
        // JSON形式でエクスポート
        const exportData = {
          exportDate: new Date().toISOString(),
          totalCount: todos.length,
          user: {
            id: session.user.id,
            email: session.user.email
          },
          todos: todos.map(todo => ({
            id: todo.id,
            title: todo.title,
            description: todo.description,
            status: todo.status,
            priority: todo.priority,
            dueDate: todo.dueDate,
            category: todo.category,
            tags: todo.tags,
            createdAt: todo.createdAt,
            updatedAt: todo.updatedAt
          }))
        }

        return NextResponse.json(exportData)
      }

    } catch (error) {
      console.error('❌ Export error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}