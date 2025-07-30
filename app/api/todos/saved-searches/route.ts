import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// GET: 保存済み検索一覧の取得
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
        AND table_name = 'saved_searches'
      );
    `
    
    if (!(tableExists as any[])[0]?.exists) {
      return NextResponse.json([])
    }

    const savedSearches = await prisma.savedSearch.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(savedSearches)
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json([])
  }
}

// POST: 新しい保存済み検索の作成
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, filters } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Search name is required' }, { status: 400 })
    }

    // テーブルが存在するかチェック
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'saved_searches'
      );
    `
    
    if (!(tableExists as any[])[0]?.exists) {
      return NextResponse.json({ error: 'SavedSearch table does not exist' }, { status: 500 })
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        name: name.trim(),
        filters: JSON.stringify(filters),
        userId: session.user.id,
      }
    })

    return NextResponse.json(savedSearch, { status: 201 })
  } catch (error) {
    console.error('Error creating saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}