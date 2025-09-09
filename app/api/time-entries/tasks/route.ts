import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'
import { lambdaAPI } from '@/lib/lambda-api'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

// タスク別時間統計とランキングを返す
export async function GET(request: NextRequest) {
  try {
    console.log('=== TASK TIME STATS API START ===')
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const sortBy = searchParams.get('sortBy') || 'totalTime' // totalTime, sessions, efficiency
    const tz = (searchParams.get('tz') || '').trim() || undefined
    const userId = session.user.id
    
    // OAuth認証ユーザーIDから実際のデータベースユーザーIDを抽出
    const actualUserId = extractUserIdFromPrefixed(userId)
    console.log('🔄 User ID mapping for tasks API:', { userId, actualUserId })

    // まずは Lambda の集計APIが使えるなら優先して利用（DB由来の正確な集計）
    const lambdaApiUrl = process.env.LAMBDA_API_URL
    if (lambdaApiUrl) {
      try {
        const url = `${lambdaApiUrl}/time-entries/tasks?userId=${encodeURIComponent(actualUserId)}&limit=${limit}&sortBy=${encodeURIComponent(sortBy)}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`
        const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
        if (resp.ok) {
          const data = await resp.json()
          console.log('✅ Using Lambda tasks aggregation')
          return NextResponse.json(data)
        }
        console.warn('⚠️ Lambda tasks aggregation returned non-OK:', resp.status)
      } catch (e) {
        console.warn('⚠️ Lambda tasks aggregation failed, falling back to Redis logic:', e)
      }
    }

    // フォールバック: Redisを用いた簡易集計
    try {
      await redis.ping()
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      return NextResponse.json({ taskStats: [], fallback: true })
    }

    // Todo一覧をLambda APIから取得（修正されたユーザーIDを使用）
    let todos: any[] = []
    try {
      const todosResponse = await lambdaAPI.getUserTodos(actualUserId)
      todos = Array.isArray(todosResponse) ? todosResponse : []
      console.log(`📋 Found ${todos.length} todos`)
    } catch (todoError) {
      console.warn('❌ Failed to fetch todos:', todoError)
      return NextResponse.json({ taskStats: [], error: 'Todo fetch failed' })
    }

    // 各タスクの時間統計を並列取得
    const taskStatsPromises = todos.map(async (todo) => {
      const taskTimeKey = `time:task:total:${actualUserId}:${todo.id}`
      const taskStartsKey = `time:task:starts:${actualUserId}:${todo.id}`
      
      try {
        const [totalTimeStr, startsStr] = await Promise.all([
          redis.get(taskTimeKey),
          redis.get(taskStartsKey)
        ])
        
        const totalSeconds = parseInt(totalTimeStr || '0', 10)
        const sessions = parseInt(startsStr || '0', 10)
        const avgSessionTime = sessions > 0 ? Math.floor(totalSeconds / sessions) : 0
        
        return {
          taskId: todo.id,
          taskTitle: todo.title,
          taskStatus: todo.status,
          taskCategory: todo.category,
          totalSeconds,
          sessions,
          avgSessionTime,
          efficiency: sessions > 0 ? totalSeconds / sessions : 0, // 1セッションあたりの平均時間
          lastWorked: null // TODO: 最後の作業時間を記録する場合
        }
      } catch (error) {
        console.warn(`❌ Failed to get stats for task ${todo.id}:`, error)
        return {
          taskId: todo.id,
          taskTitle: todo.title,
          taskStatus: todo.status,
          taskCategory: todo.category,
          totalSeconds: 0,
          sessions: 0,
          avgSessionTime: 0,
          efficiency: 0,
          lastWorked: null
        }
      }
    })

    const taskStats = await Promise.all(taskStatsPromises)
    
    // 作業時間があるタスクのみフィルタ
    const workedTasks = taskStats.filter(task => task.totalSeconds > 0)
    
    // ソート
    let sortedTasks = [...workedTasks]
    switch (sortBy) {
      case 'sessions':
        sortedTasks.sort((a, b) => b.sessions - a.sessions)
        break
      case 'efficiency':
        sortedTasks.sort((a, b) => b.avgSessionTime - a.avgSessionTime)
        break
      case 'totalTime':
      default:
        sortedTasks.sort((a, b) => b.totalSeconds - a.totalSeconds)
        break
    }

    // 上位N件に制限
    const topTasks = sortedTasks.slice(0, limit)
    
    // 時間帯別統計も取得
    const hourlyStats = []
    for (let hour = 0; hour < 24; hour++) {
      const hourKey = `time:hour:${actualUserId}:${hour}`
      try {
        const hourSeconds = await redis.get(hourKey)
        hourlyStats.push({
          hour,
          seconds: parseInt(hourSeconds || '0', 10)
        })
      } catch (hourError) {
        hourlyStats.push({ hour, seconds: 0 })
      }
    }

    const result = {
      taskStats: topTasks,
      totalTasks: todos.length,
      workedTasks: workedTasks.length,
      totalWorkTime: workedTasks.reduce((sum, task) => sum + task.totalSeconds, 0),
      totalSessions: workedTasks.reduce((sum, task) => sum + task.sessions, 0),
      hourlyProductivity: hourlyStats,
      mostProductiveHour: hourlyStats.reduce((max, current) => 
        current.seconds > max.seconds ? current : max, 
        { hour: 9, seconds: 0 }
      )
    }

    console.log('✅ Task stats result:', {
      totalTasks: result.totalTasks,
      workedTasks: result.workedTasks,
      totalWorkTime: result.totalWorkTime
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ TASK TIME STATS API ERROR:', error)
    return NextResponse.json({ 
      taskStats: [], 
      error: 'Task stats unavailable' 
    })
  }
}
