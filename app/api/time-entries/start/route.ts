import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

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

    // テーブル作成（初回のみ）: Prismaは複数ステートメント不可のため分割実行
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_time_entries_user_started ON time_entries(user_id, started_at)`) 
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_time_entries_user_ended ON time_entries(user_id, ended_at)`) 

    const userId = session.user.id

    // 既に走っている計測があればいったん停止（冪等性）
    const running = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, started_at FROM time_entries WHERE user_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      userId,
    )
    if (running && running.length > 0) {
      const run = running[0]
      await prisma.$executeRawUnsafe(
        `UPDATE time_entries SET ended_at = NOW(), seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int, updated_at = NOW() WHERE id = $1`,
        run.id,
      )
    }

    // 新規開始
    await prisma.$executeRawUnsafe(
      `INSERT INTO time_entries (user_id, todo_id, started_at) VALUES ($1, $2, NOW())`,
      userId, todoId,
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('time-entries start error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
