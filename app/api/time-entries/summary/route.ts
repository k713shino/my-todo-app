import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: 今日/今週の合計時間（秒）を返す
export async function GET(_request: NextRequest) {
  try {
    console.log('=== TIME SUMMARY API START ===')
    
    // セッション認証
    const session = await getAuthSession()
    console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id })
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const now = new Date()
    const dayKey = `time:sum:day:${userId}:${formatDate(now)}`
    const weekKey = `time:sum:week:${userId}:${formatDate(startOfWeek(now))}`
    const runningKey = `time:run:${userId}`

    console.log('Redis keys:', { dayKey, weekKey, runningKey })

    // Redis接続テスト
    try {
      await redis.ping()
      console.log('✅ Redis ping successful')
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      // Redisが利用できない場合はデフォルト値を返す
      return NextResponse.json({ todaySeconds: 0, weekSeconds: 0 })
    }

    // Redisからデータ取得
    const [dayStr, weekStr, running] = await Promise.all([
      redis.get(dayKey),
      redis.get(weekKey),
      redis.get(runningKey),
    ])
    
    console.log('Redis data:', { dayStr, weekStr, running })

    let today = parseInt(dayStr || '0', 10)
    let week = parseInt(weekStr || '0', 10)
    
    // 進行中の計測があれば加算
    if (running) {
      try {
        const { startedAt } = JSON.parse(running)
        const started = new Date(startedAt)
        const partial = Math.max(0, Math.floor((now.getTime() - started.getTime())/1000))
        console.log('Running calculation:', { startedAt, partial })
        
        // 当日・当週に限り、進行中の分を加算（表示用）
        if (formatDate(started) === formatDate(now)) today += partial
        if (formatDate(startOfWeek(started)) === formatDate(startOfWeek(now))) week += partial
      } catch (parseError) {
        console.error('❌ Failed to parse running data:', parseError)
      }
    }

    const result = { todaySeconds: today, weekSeconds: week }
    console.log('✅ Summary result:', result)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ TIME SUMMARY API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 常にデフォルト値を返す
    return NextResponse.json({ todaySeconds: 0, weekSeconds: 0 })
  }
}

function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); const day = x.getDay(); const offset = (day + 6) % 7; x.setDate(x.getDate()-offset); return x }
function formatDate(d: Date) { const y = d.getFullYear(); const m = (d.getMonth()+1).toString().padStart(2,'0'); const dd = d.getDate().toString().padStart(2,'0'); return `${y}-${m}-${dd}` }
