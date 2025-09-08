import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// DB版: 時間追跡の詳細分析データを返す
export async function GET(request: NextRequest) {
  try {
    console.log('=== TIME ANALYTICS API START (DB VERSION) ===')
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10)
    const userId = session.user.id

    console.log('Analytics request:', { userId, days })

    try {
      const now = new Date()
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

      // 過去N日間の時間エントリーを取得
      const timeEntries = await prisma.timeEntry.findMany({
        where: {
          userId: userId,
          startedAt: {
            gte: startDate
          },
          endedAt: {
            not: null
          },
          duration: {
            not: null
          }
        },
        include: {
          todo: {
            select: {
              title: true,
              category: true
            }
          }
        },
        orderBy: {
          startedAt: 'desc'
        }
      })

      console.log(`Found ${timeEntries.length} time entries`)

      // 日次統計を計算
      const dailyStats: Array<{ date: string; seconds: number }> = []
      const dailyMap = new Map<string, number>()

      timeEntries.forEach(entry => {
        if (!entry.duration) return
        const date = entry.startedAt.toISOString().split('T')[0]
        dailyMap.set(date, (dailyMap.get(date) || 0) + entry.duration)
      })

      // 過去N日分の配列を作成（0の日も含む）
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        dailyStats.push({
          date: dateStr,
          seconds: dailyMap.get(dateStr) || 0
        })
      }

      // タスク別統計
      const taskMap = new Map<string, { title: string; totalSeconds: number; sessions: number }>()
      timeEntries.forEach(entry => {
        if (!entry.duration || !entry.todoId) return
        const taskId = entry.todoId
        const existing = taskMap.get(taskId) || { 
          title: entry.todo?.title || 'Unknown Task', 
          totalSeconds: 0, 
          sessions: 0 
        }
        existing.totalSeconds += entry.duration
        existing.sessions += 1
        taskMap.set(taskId, existing)
      })

      const taskStats = Array.from(taskMap.entries()).map(([taskId, data]) => ({
        taskId,
        taskTitle: data.title,
        taskStatus: 'unknown',
        taskCategory: 'unknown',
        totalSeconds: data.totalSeconds,
        sessions: data.sessions,
        avgSessionTime: Math.floor(data.totalSeconds / data.sessions),
        efficiency: data.totalSeconds / data.sessions
      })).sort((a, b) => b.totalSeconds - a.totalSeconds).slice(0, 10)

      // 基本統計
      const totalSeconds = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0)
      const weeklyAverage = Math.floor(totalSeconds / Math.min(days / 7, 1))

      // 生産性分析
      const nonZeroDays = dailyStats.filter(d => d.seconds > 0)
      const bestDay = nonZeroDays.length > 0 
        ? nonZeroDays.reduce((a, b) => a.seconds > b.seconds ? a : b).date 
        : ''
      const worstDay = nonZeroDays.length > 0 
        ? nonZeroDays.reduce((a, b) => a.seconds < b.seconds ? a : b).date 
        : ''

      // 一貫性計算（標準偏差ベース）
      const mean = nonZeroDays.length > 0 
        ? nonZeroDays.reduce((sum, day) => sum + day.seconds, 0) / nonZeroDays.length 
        : 0
      const variance = nonZeroDays.length > 0 
        ? nonZeroDays.reduce((sum, day) => sum + Math.pow(day.seconds - mean, 2), 0) / nonZeroDays.length 
        : 0
      const stdDev = Math.sqrt(variance)
      const consistency = mean > 0 ? Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100)) : 0

      const result = {
        totalSeconds,
        dailyStats,
        taskStats,
        weeklyAverage,
        productivity: {
          bestDay,
          worstDay,
          consistency: Math.round(consistency)
        }
      }

      console.log('✅ Analytics result:', {
        totalSeconds: result.totalSeconds,
        dailyStatsCount: result.dailyStats.length,
        taskStatsCount: result.taskStats.length,
        weeklyAverage: result.weeklyAverage
      })

      return NextResponse.json(result)
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ 
        totalSeconds: 0, 
        dailyStats: [], 
        taskStats: [],
        weeklyAverage: 0,
        productivity: { bestDay: '', worstDay: '', consistency: 0 },
        error: 'Database error'
      })
    }
  } catch (error) {
    console.error('❌ TIME ANALYTICS API ERROR:', error)
    return NextResponse.json({ 
      totalSeconds: 0, 
      dailyStats: [], 
      taskStats: [],
      weeklyAverage: 0,
      productivity: { bestDay: '', worstDay: '', consistency: 0 },
      error: 'Internal server error'
    })
  }
}