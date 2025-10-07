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

    // テーブルが存在するかチェック
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'search_history'
      );
    `
    
    if (!(tableExists as any[])[0]?.exists) {
      return NextResponse.json([])
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
    return NextResponse.json([])
  }
}

// DELETE: 検索履歴のクリア
export async function DELETE(_request: NextRequest) {
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
