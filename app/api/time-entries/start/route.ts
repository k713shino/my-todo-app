import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// DB版: タスクの時間計測を開始
export async function POST(request: NextRequest) {
  try {
    console.log('=== TIME START API START (DB VERSION) ===')
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

    const { todoId } = await request.json()
    console.log('Request data:', { todoId })
    
    if (!todoId) {
      console.log('❌ Missing todoId')
      return NextResponse.json({ error: 'todoId is required' }, { status: 400 })
    }

    const userId = session.user.id
    console.log('Starting time tracking:', { userId, todoId })

    try {
      // 既に進行中のタスクがある場合は停止
      const activeEntry = await prisma.timeEntry.findFirst({
        where: {
          userId: userId,
          endedAt: null
        }
      })

      if (activeEntry) {
        console.log('Found active entry, stopping:', activeEntry.id)
        const endedAt = new Date()
        const duration = Math.max(0, Math.floor((endedAt.getTime() - activeEntry.startedAt.getTime()) / 1000))
        
        await prisma.timeEntry.update({
          where: { id: activeEntry.id },
          data: { 
            endedAt,
            duration
          }
        })
      }

      // 新しい時間追跡を開始
      const newEntry = await prisma.timeEntry.create({
        data: {
          userId: userId,
          todoId: todoId,
          startedAt: new Date(),
          // description and category are optional for now
        }
      })

      console.log('✅ Started new tracking:', newEntry.id)
      return NextResponse.json({ success: true, entryId: newEntry.id })
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.json({ error: 'Failed to start time tracking' }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ TIME START API ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // エラー時のフォールバック
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}