import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// 時間追跡の詳細分析データを返す
export async function GET(request: NextRequest) {
  try {
    console.log('=== TIME ANALYTICS API START ===')
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10) // デフォルト30日
    const userId = session.user.id

    // Redis接続テスト
    try {
      await redis.ping()
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      return NextResponse.json({ 
        totalSeconds: 0, 
        dailyStats: [], 
        taskStats: [],
        weeklyAverage: 0,
        fallback: true 
      })
    }

    const now = new Date()
    const analytics = {
      totalSeconds: 0,
      dailyStats: [] as Array<{ date: string; seconds: number; tasks: string[] }>,
      taskStats: [] as Array<{ taskId: string; taskTitle: string; totalSeconds: number; sessions: number }>,
      weeklyAverage: 0,
      peakHours: [] as Array<{ hour: number; seconds: number }>,
      productivity: {
        bestDay: '',
        worstDay: '',
        consistency: 0 // 0-100の一貫性スコア
      }
    }

    // 過去N日分の日次データを取得
    const dailyPromises = []
    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dayKey = `time:sum:day:${userId}:${formatDate(date)}`
      dailyPromises.push(
        redis.get(dayKey).then(seconds => ({
          date: formatDate(date),
          seconds: parseInt(seconds || '0', 10),
          tasks: [] // TODO: 実装時にタスクIDも保存
        }))
      )
    }

    const dailyResults = await Promise.all(dailyPromises)
    analytics.dailyStats = dailyResults.reverse() // 古い順に並び替え

    // 合計時間計算
    analytics.totalSeconds = dailyResults.reduce((sum, day) => sum + day.seconds, 0)

    // 週平均計算
    analytics.weeklyAverage = Math.floor(analytics.totalSeconds / Math.max(days / 7, 1))

    // 生産性分析
    const sortedDays = [...dailyResults].sort((a, b) => b.seconds - a.seconds)
    if (sortedDays.length > 0) {
      analytics.productivity.bestDay = sortedDays[0].date
      analytics.productivity.worstDay = sortedDays[sortedDays.length - 1].date
      
      // 一貫性スコア（標準偏差ベース）
      if (dailyResults.length > 1) {
        const mean = analytics.totalSeconds / dailyResults.length
        const variance = dailyResults.reduce((sum, day) => sum + Math.pow(day.seconds - mean, 2), 0) / dailyResults.length
        const stdDev = Math.sqrt(variance)
        analytics.productivity.consistency = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100))
      }
    }

    console.log('✅ Analytics result:', {
      totalSeconds: analytics.totalSeconds,
      days: dailyResults.length,
      weeklyAverage: analytics.weeklyAverage
    })

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('❌ TIME ANALYTICS API ERROR:', error)
    return NextResponse.json({ 
      totalSeconds: 0, 
      dailyStats: [], 
      taskStats: [],
      weeklyAverage: 0,
      error: 'Analytics unavailable' 
    })
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${dd}`
}