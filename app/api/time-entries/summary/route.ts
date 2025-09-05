import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// MVP: 今日/今週の合計時間（秒）を返す
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // テーブルが無い環境でも500にしないため、先に作成
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS time_entries (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        todo_id TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        seconds INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    )

    // 今日の開始と終了（ローカルタイムでOK/MVP）
    const todayRes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(SUM(seconds),0) AS total
       FROM time_entries
       WHERE user_id = $1 AND ended_at IS NOT NULL
         AND DATE(ended_at) = CURRENT_DATE`,
      userId,
    )

    // 今週（月曜開始）
    const weekRes = await prisma.$queryRawUnsafe<any[]>(
      `WITH week_start AS (
         SELECT DATE_TRUNC('week', NOW() - INTERVAL '1 day') + INTERVAL '1 day' AS ws
       )
       SELECT COALESCE(SUM(seconds),0) AS total
       FROM time_entries, week_start
       WHERE user_id = $1 AND ended_at IS NOT NULL
         AND ended_at >= (SELECT ws FROM week_start)`,
      userId,
    )

    const today = Number(todayRes?.[0]?.total || 0)
    const week = Number(weekRes?.[0]?.total || 0)

    return NextResponse.json({ todaySeconds: today, weekSeconds: week })
  } catch (error) {
    console.error('time-entries summary error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
