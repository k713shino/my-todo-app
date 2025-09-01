import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { TodoStats } from '@/types/todo'
import { lambdaAPI } from '@/lib/lambda-api'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const useCache = searchParams.get('cache') !== 'false'
    const forceRefresh = searchParams.get('refresh') === 'true'

    // キャッシュから統計を取得
    const cacheKey = `stats:user:${session.user.id}`
    let stats: TodoStats | null = null
    
    if (useCache && !forceRefresh) {
      stats = await CacheManager.get<TodoStats>(cacheKey)
    }

    if (!stats) {
      // まずはユーザーTodoのキャッシュから集計（最速・一貫性重視）
      let sourceTodos: any[] | null = await CacheManager.getTodos(session.user.id) as any

      // キャッシュが無ければLambdaから取得
      if (!sourceTodos) {
        const actualUserId = extractUserIdFromPrefixed(session.user.id)
        const resp = await lambdaAPI.get(`/todos/user/${encodeURIComponent(actualUserId)}`, { timeout: 8000 })
        if (resp.success && Array.isArray(resp.data)) {
          // user API と同様にメインタスクのみへ整形
          const allTodos: any[] = resp.data
          const mainTodos = allTodos.filter((t: any) => !t.parentId)
          const safeTodos = mainTodos.map((todo: any) => {
            const subtaskCount = allTodos.filter((t: any) => t.parentId && t.parentId.toString() === todo.id.toString()).length
            return {
              id: todo.id,
              title: todo.title,
              description: todo.description || null,
              status: todo.status || (todo.completed ? 'DONE' : 'TODO'),
              priority: todo.priority || 'MEDIUM',
              dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : null,
              createdAt: new Date(todo.createdAt).toISOString(),
              updatedAt: new Date(todo.updatedAt).toISOString(),
              userId: session.user.id,
              category: todo.category || null,
              tags: Array.isArray(todo.tags) ? todo.tags : [],
              parentId: todo.parentId ? todo.parentId.toString() : null,
              _count: { subtasks: subtaskCount },
            }
          })
          sourceTodos = safeTodos
        }
      }

      if (sourceTodos) {
        // クライアント側と同じ定義で集計することで整合を取る
        const now = Date.now()
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
        const monthStart = new Date(); monthStart.setMonth(monthStart.getMonth() - 1)

        const totalCount = sourceTodos.length
        const byStatus = {
          todo: sourceTodos.filter((t: any) => t.status === 'TODO').length,
          inProgress: sourceTodos.filter((t: any) => t.status === 'IN_PROGRESS').length,
          review: sourceTodos.filter((t: any) => t.status === 'REVIEW').length,
          done: sourceTodos.filter((t: any) => t.status === 'DONE').length,
        }
        const overdueCount = sourceTodos.filter((t: any) => t.dueDate && t.status !== 'DONE' && now > new Date(t.dueDate).getTime()).length
        const byPriority = {
          urgent: sourceTodos.filter((t: any) => t.priority === 'URGENT').length,
          high: sourceTodos.filter((t: any) => t.priority === 'HIGH').length,
          medium: sourceTodos.filter((t: any) => t.priority === 'MEDIUM').length,
          low: sourceTodos.filter((t: any) => t.priority === 'LOW').length,
        }
        const mainTaskCount = sourceTodos.filter((t: any) => !t.parentId).length
        const subTaskCount = sourceTodos.filter((t: any) => t.parentId).length
        const weeklyDone = sourceTodos.filter((t: any) => t.status === 'DONE' && new Date(t.updatedAt).getTime() >= weekStart.getTime()).length
        const monthlyDone = sourceTodos.filter((t: any) => t.status === 'DONE' && new Date(t.updatedAt).getTime() >= monthStart.getTime()).length

        stats = {
          total: totalCount,
          byStatus,
          overdue: overdueCount,
          byPriority,
          subtasks: { total: subTaskCount, mainTasks: mainTaskCount, subTasks: subTaskCount },
          completed: byStatus.done,
          active: totalCount - byStatus.done,
          weeklyDone,
          monthlyDone,
          unavailable: false,
        }

        if (useCache) {
          await CacheManager.set(cacheKey, stats, 300)
        }
      } else {
        // 最後のフォールバック：従来のPrisma集計（DBが空なら0）
        // Lambda/キャッシュのどちらも取得できない時点で統計の信頼性は低いので
        // カードは非表示にできるよう unavailable を true にする
        let errorCount = 0
        const safeCount = async (args: any) => {
          try { return await prisma.todo.count(args) } catch (e: any) { errorCount++; return 0 }
        }
        const [totalCount, doneCount] = await Promise.all([
          safeCount({ where: { userId: session.user.id } }),
          safeCount({ where: { userId: session.user.id, status: 'DONE' } }),
        ])
        stats = {
          total: totalCount,
          byStatus: { todo: 0, inProgress: 0, review: 0, done: doneCount },
          overdue: 0,
          byPriority: { urgent: 0, high: 0, medium: 0, low: 0 },
          subtasks: { total: 0, mainTasks: 0, subTasks: 0 },
          completed: doneCount,
          active: Math.max(totalCount - doneCount, 0),
          weeklyDone: 0,
          monthlyDone: 0,
          unavailable: true, // 明示的に非表示対象にする
        }
      }
    }

    const res = NextResponse.json({
      ...stats,
      cached: !!stats,
      lastUpdated: new Date().toISOString()
    })
    if (stats?.unavailable) {
      res.headers.set('X-Stats-Availability', 'unavailable')
    } else {
      res.headers.set('X-Stats-Availability', 'ok')
    }
    return res
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
