import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { TodoStats } from '@/types/todo'
import { lambdaAPI } from '@/lib/lambda-api'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { Status } from '@prisma/client'

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
    // パラメータ: 週数、月数、週開始、タイムゾーン
    const weeksParam = parseInt(searchParams.get('weeks') || '0', 10)
    const weeks = isFinite(weeksParam) && weeksParam > 0 && weeksParam <= 52 ? weeksParam : 8
    const monthsParam = parseInt(searchParams.get('months') || '0', 10)
    const months = isFinite(monthsParam) && monthsParam > 0 && monthsParam <= 24 ? monthsParam : 6
    const weekStartParam = (searchParams.get('weekStart') || 'mon').toLowerCase()
    const weekStart: 'mon' | 'sun' = weekStartParam === 'sun' ? 'sun' : 'mon'
    const tzParam = (searchParams.get('tz') || '').toUpperCase()
    const tz: 'UTC' | 'local' = tzParam === 'UTC' ? 'UTC' : 'local'

    // キャッシュから統計を取得
    const cacheKey = `stats:user:${session.user.id}`
    let stats: TodoStats | null = null
    
    if (useCache && !forceRefresh) {
      stats = await CacheManager.get<TodoStats>(cacheKey)
    }

    if (!stats) {
      interface TodoItem {
        id: string
        title: string
        description?: string | null
        status: string
        priority: string
        dueDate?: string | null
        createdAt: string
        updatedAt: string
        userId: string
        category?: string | null
        tags: string[]
        parentId?: string | null
        _count?: { subtasks: number }
      }
      // まずはユーザーTodoのキャッシュから集計（最速・一貫性重視）
      let sourceTodos: TodoItem[] | null = await CacheManager.getTodos(session.user.id) as TodoItem[] | null

      // キャッシュが無ければLambdaから取得
      if (!sourceTodos) {
        const actualUserId = extractUserIdFromPrefixed(session.user.id)
        const resp = await lambdaAPI.get(`/todos/user/${encodeURIComponent(actualUserId)}`, { timeout: 8000 })
        if (resp.success && Array.isArray(resp.data)) {
          // user API と同様にメインタスクのみへ整形
          const allTodos = resp.data as TodoItem[]
          const mainTodos = allTodos.filter((t) => !t.parentId)
          const safeTodos = mainTodos.map((todo) => {
            const subtaskCount = allTodos.filter((t) => t.parentId && t.parentId.toString() === todo.id.toString()).length
            const todoWithCompleted = todo as TodoItem & { completed?: boolean }
            return {
              id: todo.id,
              title: todo.title,
              description: todo.description || null,
              status: todo.status || (todoWithCompleted.completed ? 'DONE' : 'TODO'),
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
        const weekStartRef = new Date(); weekStartRef.setDate(weekStartRef.getDate() - 7)
        const monthStart = new Date(); monthStart.setMonth(monthStart.getMonth() - 1)

        const totalCount = sourceTodos.length
        const byStatus = {
          todo: sourceTodos.filter((t) => t.status === 'TODO').length,
          inProgress: sourceTodos.filter((t) => t.status === 'IN_PROGRESS').length,
          review: sourceTodos.filter((t) => t.status === 'REVIEW').length,
          done: sourceTodos.filter((t) => t.status === 'DONE').length,
        }
        const overdueCount = sourceTodos.filter((t) => t.dueDate && t.status !== 'DONE' && now > new Date(t.dueDate).getTime()).length
        const byPriority = {
          urgent: sourceTodos.filter((t) => t.priority === 'URGENT').length,
          high: sourceTodos.filter((t) => t.priority === 'HIGH').length,
          medium: sourceTodos.filter((t) => t.priority === 'MEDIUM').length,
          low: sourceTodos.filter((t) => t.priority === 'LOW').length,
        }
        const weeklyDone = sourceTodos.filter((t) => t.status === 'DONE' && new Date(t.updatedAt).getTime() >= weekStartRef.getTime()).length
        const monthlyDone = sourceTodos.filter((t) => t.status === 'DONE' && new Date(t.updatedAt).getTime() >= monthStart.getTime()).length
        // 週次完了推移（可変週数・週開始・タイムゾーン）
        const weekBuckets: Array<{ start: Date; end: Date; label: string; count: number }> = []
        const toLocalMidnight = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x }
        const toUtcMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0))
        const getDay = (d: Date) => tz === 'UTC' ? d.getUTCDay() : d.getDay()
        const shiftDays = (d: Date, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x }
        const startOfThisWeek = (() => {
          const nowD = new Date()
          const base = tz === 'UTC' ? toUtcMidnight(new Date(nowD)) : toLocalMidnight(new Date(nowD))
          const day = getDay(base)
          // 月曜開始 => 月=1, 日=0 として、(day+6)%7 を引く
          const offset = weekStart === 'mon' ? ((day + 6) % 7) : day
          return shiftDays(base, -offset)
        })()
        const fmtMD = (d: Date) => {
          const _y = tz === 'UTC' ? d.getUTCFullYear() : d.getFullYear()
          const m = (tz === 'UTC' ? d.getUTCMonth() : d.getMonth()) + 1
          const dd = tz === 'UTC' ? d.getUTCDate() : d.getDate()
          return `${m}/${dd}`
        }
        let cursor = startOfThisWeek
        for (let i = 0; i < weeks; i++) {
          const start = new Date(cursor)
          const end = shiftDays(start, 7)
          const label = `${fmtMD(start)}`
          weekBuckets.unshift({ start, end, label, count: 0 })
          cursor = shiftDays(cursor, -7)
        }
        for (const t of sourceTodos) {
          if (t.status !== 'DONE') continue
          const u = new Date(t.updatedAt)
          for (const b of weekBuckets) {
            if (u >= b.start && u < b.end) { b.count++; break }
          }
        }

        // 月次完了推移
        const monthBuckets: Array<{ y: number; m: number; start: Date; end: Date; label: string; count: number }> = []
        const startOfMonth = (src: Date) => {
          const y = tz === 'UTC' ? src.getUTCFullYear() : src.getFullYear()
          const m = tz === 'UTC' ? src.getUTCMonth() : src.getMonth()
          return tz === 'UTC'
            ? new Date(Date.UTC(y, m, 1, 0, 0, 0))
            : new Date(y, m, 1, 0, 0, 0)
        }
        const addMonths = (src: Date, diff: number) => {
          const d = new Date(src)
          if (tz === 'UTC') {
            d.setUTCMonth(d.getUTCMonth() + diff)
            d.setUTCDate(1); d.setUTCHours(0,0,0,0)
          } else {
            d.setMonth(d.getMonth() + diff)
            d.setDate(1); d.setHours(0,0,0,0)
          }
          return d
        }
        const fmtYM = (d: Date) => {
          const y = tz === 'UTC' ? d.getUTCFullYear() : d.getFullYear()
          const m = (tz === 'UTC' ? d.getUTCMonth() : d.getMonth()) + 1
          return `${y}/${String(m).padStart(2,'0')}`
        }
        const monthCursor = startOfMonth(new Date())
        for (let i = 0; i < months; i++) {
          const start = addMonths(monthCursor, -i)
          const end = addMonths(start, 1)
          const label = fmtYM(start)
          monthBuckets.unshift({ y: tz==='UTC'?start.getUTCFullYear():start.getFullYear(), m: (tz==='UTC'?start.getUTCMonth():start.getMonth())+1, start, end, label, count: 0 })
        }
        for (const t of sourceTodos) {
          if (t.status !== 'DONE') continue
          const u = new Date(t.updatedAt)
          for (const b of monthBuckets) {
            if (u >= b.start && u < b.end) { b.count++; break }
          }
        }
        const categoryBreakdown: Record<string, number> = {}
        for (const t of sourceTodos) {
          const cat = t.category || '未分類'
          categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + 1
        }

        stats = {
          total: totalCount,
          byStatus,
          overdue: overdueCount,
          byPriority,
          categoryBreakdown,
          completed: byStatus.done,
          active: totalCount - byStatus.done,
          weeklyDone,
          monthlyDone,
          unavailable: false,
          weeklyTrend: weekBuckets.map(b => ({ label: b.label, count: b.count })),
          trendMeta: { weeks, weekStart, tz },
          monthlyTrend: monthBuckets.map(b => ({ label: b.label, count: b.count })),
          monthMeta: { months, tz },
        }

        if (useCache) {
          await CacheManager.set(cacheKey, stats, 300)
        }
      } else {
        // 最後のフォールバック：従来のPrisma集計（DBが空なら0）
        // Lambda/キャッシュのどちらも取得できない時点で統計の信頼性は低いので
        // カードは非表示にできるよう unavailable を true にする
        const safeCount = async (args: { where: { userId: string; status?: Status } }) => {
          try { return await prisma.todo.count(args) } catch { return 0 }
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
          categoryBreakdown: {},
          completed: doneCount,
          active: Math.max(totalCount - doneCount, 0),
          weeklyDone: 0,
          monthlyDone: 0,
          unavailable: true, // 明示的に非表示対象にする
          weeklyTrend: Array.from({ length: weeks }).map((_, i) => ({ label: `W-${i+1}`, count: 0 })),
          trendMeta: { weeks, weekStart, tz },
          monthlyTrend: Array.from({ length: months }).map((_, i) => ({ label: `M-${i+1}`, count: 0 })),
          monthMeta: { months, tz },
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
