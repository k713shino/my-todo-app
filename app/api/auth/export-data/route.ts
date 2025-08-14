import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1時間に3回まで）- エラーハンドリング付き
    try {
      const { RateLimiter } = await import('@/lib/cache')
      const rateLimitResult = await RateLimiter.checkRateLimit(
        `export_data:${session.user.id}`, 
        3600, 
        3
      )
      
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'データエクスポートの試行回数が上限に達しました。1時間後に再試行してください。' },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      console.warn('⚠️ レート制限チェックをスキップ:', rateLimitError)
      // レート制限エラーでも処理を続行
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    console.log('🔍 エクスポートAPI開始 - ユーザーID:', session.user.id, 'フォーマット:', format)

    // ユーザーデータを取得（エラーハンドリング付き）
    let userData
    try {
      userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          todos: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
      console.log('✅ ユーザーデータ取得成功 - Todo数:', userData?.todos?.length || 0)
    } catch (dbError) {
      console.error('❌ データベース取得エラー:', dbError)
      return NextResponse.json({ 
        error: 'データベース接続エラーが発生しました' 
      }, { status: 500 })
    }

    if (!userData) {
      console.warn('⚠️ ユーザーが見つかりません:', session.user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // エクスポート用データ構造
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        format: format,
        version: '1.0'
      },
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      },
      todos: userData.todos.map(todo => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        priority: todo.priority,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      })),
      statistics: {
        totalTodos: userData.todos.length,
        completedTodos: userData.todos.filter(t => t.completed).length,
        todosByPriority: {
          URGENT: userData.todos.filter(t => t.priority === 'URGENT').length,
          HIGH: userData.todos.filter(t => t.priority === 'HIGH').length,
          MEDIUM: userData.todos.filter(t => t.priority === 'MEDIUM').length,
          LOW: userData.todos.filter(t => t.priority === 'LOW').length
        }
      }
    }

    // 形式に応じてレスポンス生成
    if (format === 'csv') {
      // CSV形式
      const csvHeaders = [
        'ID', 'Title', 'Description', 'Completed', 'Priority', 'Due Date', 'Created At', 'Updated At'
      ]
      
      const csvRows = userData.todos.map(todo => {
        const escapeCsv = (str: string | null) => {
          if (!str) return ''
          return `"${str.replace(/"/g, '""')}"`
        }
        
        return [
          todo.id,
          escapeCsv(todo.title),
          escapeCsv(todo.description),
          todo.completed ? 'true' : 'false',
          todo.priority,
          todo.dueDate ? new Date(todo.dueDate).toISOString() : '',
          new Date(todo.createdAt).toISOString(),
          new Date(todo.updatedAt).toISOString()
        ]
      })

      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="todo-data-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      // JSON形式
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="todo-data-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    }

  } catch (error) {
    console.error('❌ Data export error:', error)
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'データエクスポートに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}