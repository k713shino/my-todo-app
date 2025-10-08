import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Account linking API started')
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { databaseUserId } = await request.json()
    
    if (!databaseUserId) {
      return NextResponse.json({ 
        error: 'Database user ID is required' 
      }, { status: 400 })
    }

    console.log(`🔗 Linking OAuth user ${session.user.id} with database user ${databaseUserId}`)

    // Lambda経由でユーザーデータの存在確認
    const lambdaDB = await import('@/lib/lambda-db')
    const todosResult = await lambdaDB.default.getTodos(databaseUserId)
    
    if (!todosResult.success) {
      return NextResponse.json({ 
        error: 'Database user not found or no access',
        details: todosResult.error
      }, { status: 404 })
    }

    const todos = todosResult.data || []
    console.log(`✅ Found ${todos.length} todos for database user ${databaseUserId}`)

    // セッション情報を更新（実際の実装では、データベースに保存すべき）
    // 現在は一時的にレスポンスで返すのみ
    return NextResponse.json({
      success: true,
      message: 'Account linking verified successfully',
      linkedAccount: {
        oauthUserId: session.user.id,
        databaseUserId: databaseUserId,
        todoCount: todos.length
      },
      recommendation: 'Update your session or database to use the linked account ID'
    })

  } catch (error) {
    console.error('❌ Account linking error:', error)
    return NextResponse.json({
      error: 'Account linking failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// 利用可能なデータベースユーザーを取得
export async function GET() {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Lambda APIから全ユーザーのTodoデータを取得
    const lambdaDB = await import('@/lib/lambda-db')
    const allTodosResult = await lambdaDB.default.request('/todos', { method: 'GET' })
    
    if (!allTodosResult.success) {
      return NextResponse.json({ 
        error: 'Failed to fetch user data',
        details: allTodosResult.error
      }, { status: 500 })
    }

    const todoList = allTodosResult.data as Record<string, unknown>[]
    const uniqueUserIds = Array.from(new Set(todoList.map((todo: Record<string, unknown>) => todo.userId)))
    
    const userStats = uniqueUserIds.map(userId => {
      const userTodos = todoList.filter((todo: Record<string, unknown>) => todo.userId === userId)
      return {
        userId,
        todoCount: userTodos.length,
        completedCount: userTodos.filter((todo: Record<string, unknown>) => todo.completed).length,
        sampleTodos: userTodos.slice(0, 3).map((todo: Record<string, unknown>) => ({
          id: todo.id,
          title: todo.title,
          category: todo.category,
          createdAt: todo.createdAt
        })),
        lastActivity: Math.max(...userTodos.map((todo: Record<string, unknown>) => new Date(String(todo.updatedAt)).getTime()))
      }
    }).sort((a, b) => b.lastActivity - a.lastActivity) // 最新活動順

    return NextResponse.json({
      success: true,
      currentOAuthUserId: session.user.id,
      availableDbUsers: userStats,
      totalUsers: uniqueUserIds.length,
      totalTodos: todoList.length
    })

  } catch (error) {
    console.error('❌ Get available users error:', error)
    return NextResponse.json({
      error: 'Failed to get available users',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}