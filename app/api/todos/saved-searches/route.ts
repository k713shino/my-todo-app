import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'

// GET: 保存済み検索一覧の取得
export async function GET(_request: NextRequest) {
  try {
    console.log('🔍 API: 保存済み検索一覧取得開始')
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      console.log('❌ API: 認証失敗')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ API: 認証成功', (session as any).user.id)

    try {
      const savedSearches = await lambdaAPI.getUserSavedSearches((session as any).user.id)
      console.log('📋 API: 取得した保存済み検索数:', savedSearches.length)
      return NextResponse.json(savedSearches)
    } catch (error) {
      console.error('Error fetching saved searches:', error)
      return NextResponse.json([])
    }
  } catch (error) {
    console.error('Error in saved searches API:', error)
    return NextResponse.json([])
  }
}

// POST: 新しい保存済み検索の作成
export async function POST(request: NextRequest) {
  try {
    console.log('💾 API: 保存済み検索作成開始')
    
    // セッション取得の詳細なエラーハンドリングを追加
    let session
    try {
      console.log('🔐 セッション取得開始...')
      session = await getAuthSession()
      console.log('🔐 セッション取得完了:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email
      })
    } catch (sessionError) {
      console.error('❌ セッション取得エラー:', {
        error: sessionError,
        message: sessionError instanceof Error ? sessionError.message : 'Unknown',
        stack: sessionError instanceof Error ? sessionError.stack : 'No stack'
      })
      return NextResponse.json({ error: 'Session error', details: sessionError instanceof Error ? sessionError.message : 'Unknown' }, { status: 500 })
    }
    
    if (!isAuthenticated(session)) {
      console.log('❌ API: 認証失敗', { hasSession: !!session, hasUser: !!(session as any)?.user })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ API: 認証成功', { userId: (session as any).user.id, userEmail: (session as any).user.email })

    // リクエストボディの解析エラーハンドリング
    let body
    try {
      body = await request.json()
      console.log('📦 API: 受信データ:', { name: body?.name, filters: body?.filters, hasBody: !!body })
    } catch (jsonError) {
      console.error('❌ JSON解析エラー:', jsonError)
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { name, filters } = body

    if (!name?.trim()) {
      console.log('❌ API: 検索名が空です', { name, nameType: typeof name })
      return NextResponse.json({ error: 'Search name is required' }, { status: 400 })
    }

    // Lambda API呼び出しの詳細なエラーハンドリング
    const requestData = {
      name: name.trim(),
      filters: typeof filters === 'string' ? filters : JSON.stringify(filters),
      userId: (session as any).user.id,
    }
    console.log('🚀 Lambda API呼び出し開始:', requestData)

    try {
      const savedSearch = await lambdaAPI.createSavedSearch(requestData)
      console.log('✅ API: 保存成功:', savedSearch)
      return NextResponse.json(savedSearch, { status: 201 })
    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError)
      return NextResponse.json({ 
        error: lambdaError instanceof Error ? lambdaError.message : 'Lambda API call failed' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('💥 予期しないエラー:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack',
      name: error instanceof Error ? error.name : 'Unknown'
    })
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
