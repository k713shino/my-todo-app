import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// MVP: 時間計測の停止
export async function POST(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    // テーブルが未作成の場合に備えて作成（分割実行）
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

    // 実行中の最新エントリを停止
    const running = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM time_entries WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      userId,
    )
    if (!running || running.length === 0) {
      return NextResponse.json({ success: true, stopped: false })
    }

    const id = running[0].id
    await prisma.$executeRawUnsafe(
      `UPDATE time_entries SET ended_at = NOW(), seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int, updated_at = NOW() WHERE id = $1`,
      id,
    )

    return NextResponse.json({ success: true, stopped: true })
  } catch (error) {
    console.error('time-entries stop error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
