import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: 時間計測の停止
export async function POST(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const runningKey = `time:run:${userId}`
    const prev = await redis.get(runningKey)
    if (!prev) {
      return NextResponse.json({ success: true, stopped: false })
    }
    try {
      const { startedAt } = JSON.parse(prev)
      const started = new Date(startedAt)
      const now = new Date()
      const sec = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
      await addToAggregates(userId, started, sec)
    } catch {}
    await redis.del(runningKey)
    return NextResponse.json({ success: true, stopped: true })
  } catch (error) {
    console.error('time-entries stop error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function addToAggregates(userId: string, startedAt: Date, seconds: number) {
  try {
    const dayKey = (d: Date) => `time:sum:day:${userId}:${formatDate(d)}`
    const weekKey = (d: Date) => `time:sum:week:${userId}:${formatDate(startOfWeek(d))}`
    if ((redis as any).incrby) {
      await (redis as any).incrby(dayKey(startedAt), seconds)
      await (redis as any).incrby(weekKey(startedAt), seconds)
    } else {
      const curDay = parseInt((await redis.get(dayKey(startedAt))) || '0', 10)
      await redis.set(dayKey(startedAt), String(curDay + seconds))
      const curWeek = parseInt((await redis.get(weekKey(startedAt))) || '0', 10)
      await redis.set(weekKey(startedAt), String(curWeek + seconds))
    }
  } catch {}
}
function startOfWeek(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); const day = x.getDay(); const offset = (day + 6) % 7; x.setDate(x.getDate()-offset); return x }
function formatDate(d: Date) { const y = d.getFullYear(); const m = (d.getMonth()+1).toString().padStart(2,'0'); const dd = d.getDate().toString().padStart(2,'0'); return `${y}-${m}-${dd}` }
