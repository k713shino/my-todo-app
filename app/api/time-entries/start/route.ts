import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: タスクの時間計測を開始
export async function POST(request: NextRequest) {
  try {
    console.log('=== TIME START API START ===')
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      REDIS_URL: process.env.REDIS_URL ? 'SET' : 'NOT_SET',
      isRedisUpstash: process.env.REDIS_URL?.includes('upstash.io') || false
    })
    
    // セッション認証
    const session = await getAuthSession()
    console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id })
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { todoId } = await request.json()
    console.log('Request data:', { todoId })
    
    if (!todoId) {
      console.log('❌ Missing todoId')
      return NextResponse.json({ error: 'todoId is required' }, { status: 400 })
    }

    const userId = session.user.id
    const runningKey = `time:run:${userId}`

    console.log('Keys:', { userId, runningKey })

    // Redis接続テスト
    try {
      const pongResult = await redis.ping()
      console.log('✅ Redis ping successful, result:', pongResult)
      console.log('Redis client status:', (redis as any).status || 'unknown')
      console.log('Redis client type:', redis.constructor.name)
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      console.error('Redis client type:', redis.constructor.name)
      console.error('Is mock Redis?', !process.env.REDIS_URL?.includes('upstash.io'))
      // Redisが利用できない場合でも成功として返す（ローカルストレージで管理）
      return NextResponse.json({ success: true, fallback: true })
    }

    // 既に走っている計測があれば集計に反映してから上書き（冪等）
    const prev = await redis.get(runningKey)
    console.log('Previous running data:', prev)
    
    if (prev) {
      try {
        const { todoId: prevTodoId, startedAt } = JSON.parse(prev)
        const started = new Date(startedAt)
        const now = new Date()
        const sec = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
        console.log('Stopping previous:', { prevTodoId, startedAt, seconds: sec })
        
        await addToAggregates(userId, started, sec, prevTodoId)
      } catch (prevError) {
        console.error('❌ Failed to process previous data:', prevError)
      }
    }

    // 新規開始を保存
    const startData = { todoId, startedAt: new Date().toISOString() }
    await redis.set(runningKey, JSON.stringify(startData))
    
    // タスク開始回数をカウント
    const taskStartKey = `time:task:starts:${userId}:${todoId}`
    try {
      await (redis as any).incr(taskStartKey)
      await redis.expire(taskStartKey, 86400 * 365) // 1年間保持
    } catch (countError) {
      console.warn('Task start count failed:', countError)
    }
    
    console.log('✅ Started new tracking:', startData)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ TIME START API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 成功として返す（クライアント側で処理）
    return NextResponse.json({ success: true, fallback: true })
  }
}

// ユーザー集計（Redis）: 日/週に加算
async function addToAggregates(userId: string, startedAt: Date, seconds: number, todoId?: string) {
  try {
    const dayKey = (d: Date) => `time:sum:day:${userId}:${formatDate(d)}`
    const weekKey = (d: Date) => `time:sum:week:${userId}:${formatDate(startOfWeek(d))}`
    
    // 日次・週次集計
    try {
      await (redis as any).incrby(dayKey(startedAt), seconds)
      await (redis as any).incrby(weekKey(startedAt), seconds)
    } catch (incrbyError) {
      // incrbyが失敗した場合はget/setにフォールバック
      const curDay = parseInt((await redis.get(dayKey(startedAt))) || '0', 10)
      await redis.set(dayKey(startedAt), String(curDay + seconds))
      const curWeek = parseInt((await redis.get(weekKey(startedAt))) || '0', 10)
      await redis.set(weekKey(startedAt), String(curWeek + seconds))
    }
    
    // タスク別時間集計
    if (todoId && seconds > 0) {
      const taskTimeKey = `time:task:total:${userId}:${todoId}`
      try {
        await (redis as any).incrby(taskTimeKey, seconds)
        await redis.expire(taskTimeKey, 86400 * 365) // 1年間保持
      } catch (taskError) {
        console.warn('Task time aggregation failed:', taskError)
      }
      
      // 時間帯別統計（生産性分析用）
      const hour = startedAt.getHours()
      const hourKey = `time:hour:${userId}:${hour}`
      try {
        await (redis as any).incrby(hourKey, seconds)
        await redis.expire(hourKey, 86400 * 90) // 90日間保持
      } catch (hourError) {
        console.warn('Hourly stats failed:', hourError)
      }
    }
  } catch (error) {
    console.error('addToAggregates error:', error)
  }
}

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0,0,0,0)
  const day = x.getDay() // 0=Sun
  const offset = (day + 6) % 7 // Monday start
  x.setDate(x.getDate() - offset)
  return x
}
function formatDate(d: Date) {
  const y = d.getFullYear()
  const m = (d.getMonth()+1).toString().padStart(2,'0')
  const dd = d.getDate().toString().padStart(2,'0')
  return `${y}-${m}-${dd}`
}
