import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'

// GET: 保存済み検索一覧の取得
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 API: 保存済み検索一覧取得開始')
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      console.log('❌ API: 認証失敗')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('✅ API: 認証成功', (session as any).user.id)

    const lambdaResponse = await lambdaAPI.getUserSavedSearchesWrapped((session as any).user.id)
    
    console.log('📡 Lambda API レスポンス:', {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      dataLength: lambdaResponse.data ? lambdaResponse.data.length : 0,
      error: lambdaResponse.error
    })

    if (lambdaResponse.success && Array.isArray(lambdaResponse.data)) {
      console.log('📋 API: 取得した保存済み検索数:', lambdaResponse.data.length)
      return NextResponse.json(lambdaResponse.data)
    }

    console.log('⚠️ Lambda API 失敗:', lambdaResponse.error)
    return NextResponse.json([])
  } catch (error) {
    console.error('Error fetching saved searches:', error)
    return NextResponse.json([])
  }
}

// POST: 新しい保存済み検索の作成
export async function POST(request: NextRequest) {
  try {
    console.log('💾 API: 保存済み検索作成開始')
    
    // セッション取得のエラーハンドリングを追加
    let session
    try {
      session = await getAuthSession()
      console.log('🔐 セッション取得成功:', session ? 'あり' : 'なし')
    } catch (sessionError) {
      console.error('❌ セッション取得エラー:', sessionError)
      return NextResponse.json({ error: 'Session error' }, { status: 500 })
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

    let lambdaResponse
    try {
      lambdaResponse = await lambdaAPI.createSavedSearchWrapped(requestData)
      console.log('📡 Lambda API 作成レスポンス受信:', {
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        error: lambdaResponse.error
      })
    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError)
      return NextResponse.json({ error: 'Lambda API call failed' }, { status: 500 })
    }

    if (lambdaResponse.success && lambdaResponse.data) {
      console.log('✅ API: 保存成功:', lambdaResponse.data.id, lambdaResponse.data.name)
      return NextResponse.json(lambdaResponse.data, { status: 201 })
    }

    console.log('❌ Lambda API 作成失敗:', lambdaResponse.error)
    return NextResponse.json({ 
      error: lambdaResponse.error || 'Failed to create saved search'
    }, { status: 500 })
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