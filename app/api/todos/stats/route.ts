import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { TodoStats } from '@/types/todo'

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
      // データベースから統計を計算
      const [
        totalCount,
        completedCount,
        todoCount,
        inProgressCount,
        reviewCount,
        doneCount,
        urgentCount,
        highCount,
        mediumCount,
        lowCount,
        overdueCount
      ] = await Promise.all([
        prisma.todo.count({ where: { userId: session.user.id } }),
        prisma.todo.count({ where: { userId: session.user.id, status: 'DONE' } }),
        prisma.todo.count({ where: { userId: session.user.id, status: 'TODO' } }),
        prisma.todo.count({ where: { userId: session.user.id, status: 'IN_PROGRESS' } }),
        prisma.todo.count({ where: { userId: session.user.id, status: 'REVIEW' } }),
        prisma.todo.count({ where: { userId: session.user.id, status: 'DONE' } }),
        prisma.todo.count({ where: { userId: session.user.id, priority: 'URGENT' } }),
        prisma.todo.count({ where: { userId: session.user.id, priority: 'HIGH' } }),
        prisma.todo.count({ where: { userId: session.user.id, priority: 'MEDIUM' } }),
        prisma.todo.count({ where: { userId: session.user.id, priority: 'LOW' } }),
        prisma.todo.count({ 
          where: { 
            userId: session.user.id, 
            status: { not: 'DONE' },
            dueDate: { lt: new Date() }
          } 
        })
      ])

      stats = {
        total: totalCount,
        byStatus: {
          todo: todoCount,
          inProgress: inProgressCount,
          review: reviewCount,
          done: doneCount
        },
        overdue: overdueCount,
        byPriority: {
          urgent: urgentCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount
        },
        // 後方互換性
        completed: completedCount,
        active: totalCount - completedCount
      }

      // 統計をキャッシュ（30分間）
      if (useCache) {
        await CacheManager.set(cacheKey, stats, 1800)
      }
    }

    return NextResponse.json({
      ...stats,
      cached: !!stats,
      lastUpdated: new Date().toISOString()
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}