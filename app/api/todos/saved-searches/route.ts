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

    console.log('✅ API: 認証成功', session.user.id)

    const lambdaResponse = await lambdaAPI.get(`/saved-searches/user/${encodeURIComponent(session.user.id)}`)
    
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

    const lambdaResponse = await lambdaAPI.post('/saved-searches', {
      name: name.trim(),
      filters: typeof filters === 'string' ? filters : JSON.stringify(filters),
      userId: session.user.id,
    })

    console.log('📡 Lambda API 作成レスポンス:', {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      error: lambdaResponse.error
    })

    if (lambdaResponse.success && lambdaResponse.data) {
      console.log('✅ API: 保存成功:', lambdaResponse.data.id, lambdaResponse.data.name)
      return NextResponse.json(lambdaResponse.data, { status: 201 })
    }

    console.log('❌ Lambda API 作成失敗:', lambdaResponse.error)
    return NextResponse.json({ 
      error: lambdaResponse.error || 'Failed to create saved search' 
    }, { status: 500 })
  } catch (error) {
    console.error('Error creating saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}