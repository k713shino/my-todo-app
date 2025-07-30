import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// GET: 検索履歴の取得
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const searchHistory = await prisma.searchHistory.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: limit
    })

    return NextResponse.json(searchHistory)
  } catch (error) {
    console.error('Error fetching search history:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: 検索履歴のクリア
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.searchHistory.deleteMany({
      where: {
        userId: session.user.id,
      }
    })

    return NextResponse.json({ message: 'Search history cleared successfully' })
  } catch (error) {
    console.error('Error clearing search history:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}