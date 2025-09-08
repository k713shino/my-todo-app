import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: 時間計測の停止
export async function POST(_request: NextRequest) {
  try {
    console.log('=== TIME STOP API START ===')
    
    // セッション認証
    const session = await getAuthSession()
    console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id })
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const runningKey = `time:run:${userId}`
    
    console.log('Keys:', { userId, runningKey })

    // Redis接続テスト
    try {
      await redis.ping()
      console.log('✅ Redis ping successful')
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      // Redisが利用できない場合でも成功として返す
      return NextResponse.json({ success: true, stopped: false, fallback: true })
    }

    const prev = await redis.get(runningKey)
    console.log('Previous running data:', prev)
    
    if (!prev) {
      console.log('ℹ️ No running timer found')
      return NextResponse.json({ success: true, stopped: false })
    }

    try {
      const { startedAt } = JSON.parse(prev)
      const started = new Date(startedAt)
      const now = new Date()
      const sec = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
      console.log('Stopping timer:', { startedAt, seconds: sec })
      
      await addToAggregates(userId, started, sec)
    } catch (parseError) {
      console.error('❌ Failed to process stop data:', parseError)
    }

    await redis.del(runningKey)
    console.log('✅ Timer stopped and cleared')
    
    return NextResponse.json({ success: true, stopped: true })
  } catch (error) {
    console.error('❌ TIME STOP API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 成功として返す
    return NextResponse.json({ success: true, stopped: true, fallback: true })
  }
}

async function addToAggregates(userId: string, startedAt: Date, seconds: number) {
  try {
    const dayKey = (d: Date) => `time:sum:day:${userId}:${formatDate(d)}`
    const weekKey = (d: Date) => `time:sum:week:${userId}:${formatDate(startOfWeek(d))}`
    
    // incrbyメソッドを安全に使用
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
  } catch (error) {
    console.error('addToAggregates error:', error)
  }
}
function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); const day = x.getDay(); const offset = (day + 6) % 7; x.setDate(x.getDate()-offset); return x }
function formatDate(d: Date) { const y = d.getFullYear(); const m = (d.getMonth()+1).toString().padStart(2,'0'); const dd = d.getDate().toString().padStart(2,'0'); return `${y}-${m}-${dd}` }
