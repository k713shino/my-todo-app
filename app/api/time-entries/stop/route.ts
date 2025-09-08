import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// DB版: 時間計測を停止
export async function POST(request: NextRequest) {
  try {
    console.log('=== TIME STOP API START (DB VERSION) ===')
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET'
    })
    
    // セッション認証
    const session = await getAuthSession()
    console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id })
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    console.log('Stopping time tracking for user:', userId)

    try {
      // 進行中のタスクを検索
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          userId: userId,
          endedAt: null
        },
        include: {
          todo: {
            select: {
              title: true
            }
          }
        }
      })

      if (!activeEntry) {
        console.log('❌ No active time tracking found')
        return NextResponse.json({ success: true, stopped: false, message: 'No active time tracking found' })
      }

      // 終了時刻と継続時間を計算
      const endedAt = new Date()
      const duration = Math.max(0, Math.floor((endedAt.getTime() - activeEntry.startedAt.getTime()) / 1000))

      // TimeEntryを更新
      const updatedEntry = await prisma.timeEntry.update({
        where: { id: activeEntry.id },
        data: { 
          endedAt,
          duration
        },
        include: {
          todo: {
            select: {
              title: true
            }
          }
        }
      })

      console.log('✅ Stopped time tracking:', {
        entryId: updatedEntry.id,
        todoTitle: updatedEntry.todo?.title,
        duration: duration,
        durationMinutes: Math.floor(duration / 60)
      })

      return NextResponse.json({ 
        success: true, 
        stopped: true,
        entryId: updatedEntry.id,
        duration: duration,
        durationMinutes: Math.floor(duration / 60),
        todoTitle: updatedEntry.todo?.title
      })
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ error: 'Failed to stop time tracking' }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ TIME STOP API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // エラー時のフォールバック
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}