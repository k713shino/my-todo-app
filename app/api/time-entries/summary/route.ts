import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// DB版: 今日/今週の合計時間（秒）を返す
export async function GET(_request: NextRequest) {
  try {
    console.log('=== TIME SUMMARY API START (DB VERSION) ===')
    console.log('Environment check:', {
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
    const now = new Date()
    
    // 今日の開始時刻（00:00:00）
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    
    // 今週の開始時刻（月曜日の00:00:00）
    const weekStart = startOfWeek(now)
    
    console.log('Time ranges:', { 
      userId, 
      todayStart: todayStart.toISOString(), 
      weekStart: weekStart.toISOString(),
      now: now.toISOString()
    })

    try {
      // 今日の完了した作業時間を取得
      const todayCompleted = await prisma.timeEntry.aggregate({
        where: {
          userId: userId,
          startedAt: {
            gte: todayStart,
            lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000) // 明日の00:00:00まで
          },
          endedAt: {
            not: null
          }
        },
        _sum: {
          duration: true
        }
      })

      // 今週の完了した作業時間を取得
      const weekCompleted = await prisma.timeEntry.aggregate({
        where: {
          userId: userId,
          startedAt: {
            gte: weekStart
          },
          endedAt: {
            not: null
          }
        },
        _sum: {
          duration: true
        }
      })

      // 現在進行中のタスクがあれば追加
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          userId: userId,
          endedAt: null
        }
      })

      let todaySeconds = todayCompleted._sum.duration || 0
      let weekSeconds = weekCompleted._sum.duration || 0

      if (activeEntry) {
        const currentSessionDuration = Math.max(0, Math.floor((now.getTime() - activeEntry.startedAt.getTime()) / 1000))
        console.log('Active session:', {
          entryId: activeEntry.id,
          startedAt: activeEntry.startedAt,
          currentDuration: currentSessionDuration
        })

        // 今日開始されたセッションの場合、今日の合計に加算
        if (activeEntry.startedAt >= todayStart) {
          todaySeconds += currentSessionDuration
        }
        
        // 今週開始されたセッションの場合、今週の合計に加算
        if (activeEntry.startedAt >= weekStart) {
          weekSeconds += currentSessionDuration
        }
      }

      const result = { todaySeconds, weekSeconds }
      console.log('✅ Summary result:', result)
      
      return NextResponse.json(result)
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ todaySeconds: 0, weekSeconds: 0, error: 'Database error' })
    }
  } catch (error) {
    console.error('❌ TIME SUMMARY API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 常にデフォルト値を返す
    return NextResponse.json({ todaySeconds: 0, weekSeconds: 0 })
  }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sunday
  const offset = (day + 6) % 7 // Monday start
  x.setDate(x.getDate() - offset)
  return x
}