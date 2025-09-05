import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: 今日/今週の合計時間（秒）を返す
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const now = new Date()
    const dayKey = `time:sum:day:${userId}:${formatDate(now)}`
    const weekKey = `time:sum:week:${userId}:${formatDate(startOfWeek(now))}`
    const runningKey = `time:run:${userId}`

    const [dayStr, weekStr, running] = await Promise.all([
      redis.get(dayKey),
      redis.get(weekKey),
      redis.get(runningKey),
    ])
    let today = parseInt(dayStr || '0', 10)
    let week = parseInt(weekStr || '0', 10)
    if (running) {
      try {
        const { startedAt } = JSON.parse(running)
        const started = new Date(startedAt)
        const partial = Math.max(0, Math.floor((now.getTime() - started.getTime())/1000))
        // 当日・当週に限り、進行中の分を加算（表示用）
        if (formatDate(started) === formatDate(now)) today += partial
        if (formatDate(startOfWeek(started)) === formatDate(startOfWeek(now))) week += partial
      } catch {}
    }
    return NextResponse.json({ todaySeconds: today, weekSeconds: week })
  } catch (error) {
    console.error('time-entries summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); const day = x.getDay(); const offset = (day + 6) % 7; x.setDate(x.getDate()-offset); return x }
function formatDate(d: Date) { const y = d.getFullYear(); const m = (d.getMonth()+1).toString().padStart(2,'0'); const dd = d.getDate().toString().padStart(2,'0'); return `${y}-${m}-${dd}` }
