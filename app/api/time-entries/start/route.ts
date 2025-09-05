import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// MVP: タスクの時間計測を開始
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { todoId } = await request.json()
    if (!todoId) {
      return NextResponse.json({ error: 'todoId is required' }, { status: 400 })
    }

    const userId = session.user.id
    const runningKey = `time:run:${userId}`

    // 既に走っている計測があれば集計に反映してから上書き（冪等）
    const prev = await redis.get(runningKey)
    if (prev) {
      try {
        const { todoId: prevTodoId, startedAt } = JSON.parse(prev)
        const started = new Date(startedAt)
        const now = new Date()
        const sec = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 1000))
        await addToAggregates(userId, started, sec)
      } catch {}
    }

    // 新規開始を保存
    await redis.set(runningKey, JSON.stringify({ todoId, startedAt: new Date().toISOString() }))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('time-entries start error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// ユーザー集計（Redis）: 日/週に加算
async function addToAggregates(userId: string, startedAt: Date, seconds: number) {
  try {
    const dayKey = (d: Date) => `time:sum:day:${userId}:${formatDate(d)}`
    const weekKey = (d: Date) => `time:sum:week:${userId}:${formatDate(startOfWeek(d))}`
    // ioredisのincrbyは型定義に無い環境もあるため安全に実行
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
