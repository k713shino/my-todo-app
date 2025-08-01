import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// GET: 保存済み検索一覧の取得
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: 保存済み検索一覧取得開始')
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      console.log('❌ API: 認証失敗')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ API: 認証成功', session.user.id)

    // テーブルが存在するかチェック
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'saved_searches'
      );
    `
    
    console.log('🏗️ API: テーブル存在チェック:', (tableExists as any[])[0]?.exists)
    
    if (!(tableExists as any[])[0]?.exists) {
      console.log('❌ API: saved_searchesテーブルが存在しません')
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

    console.log('📋 API: 取得した保存済み検索数:', savedSearches.length)
    console.log('📝 API: 詳細:', savedSearches.map(s => ({ id: s.id, name: s.name })))

    return NextResponse.json(savedSearches)
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json([])
  }
}

// POST: 新しい保存済み検索の作成
export async function POST(request: NextRequest) {
  try {
    console.log('💾 API: 保存済み検索作成開始')
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      console.log('❌ API: 認証失敗')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, filters } = body
    console.log('📦 API: 受信データ:', { name, filters })

    if (!name?.trim()) {
      console.log('❌ API: 検索名が空です')
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
    
    console.log('🏗️ API: テーブル存在チェック:', (tableExists as any[])[0]?.exists)
    
    if (!(tableExists as any[])[0]?.exists) {
      console.log('❌ API: saved_searchesテーブルが存在しません')
      return NextResponse.json({ error: 'SavedSearch table does not exist' }, { status: 500 })
    }

    const savedSearch = await prisma.savedSearch.create({
      data: {
        name: name.trim(),
        filters: typeof filters === 'string' ? filters : JSON.stringify(filters),
        userId: session.user.id,
      }
    })

    console.log('✅ API: 保存成功:', savedSearch.id, savedSearch.name)
    return NextResponse.json(savedSearch, { status: 201 })
  } catch (error) {
    console.error('Error creating saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}