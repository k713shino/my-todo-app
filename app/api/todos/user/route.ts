/**
 * 🚀 高速ユーザー専用Todo取得API
 * Lambda関数の最適化されたエンドポイントを使用
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createAuthErrorResponse } from '@/lib/auth-utils'
import { CacheManager } from '@/lib/cache'
import { lambdaAPI } from '@/lib/lambda-api'
import { createSecurityHeaders } from '@/lib/security'

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const authResult = await getAuthenticatedUser(request)
  
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }
  
  const userId = authResult.user.id
  console.log('⚡ 高速ユーザー専用Todo取得開始:', { userId })
  
  try {
    // キャッシュバイパスチェック
    const { searchParams } = new URL(request.url)
    const bypassCache = searchParams.get('cache') === 'false'
    
    // 📦 Redis キャッシュから取得を試行
    if (!bypassCache) {
      console.log('📦 Redis キャッシュ確認中...')
      const cachedTodos = await CacheManager.getTodos(userId)
      
      if (cachedTodos && cachedTodos.length >= 0) {
        const cacheTime = performance.now() - startTime
        console.log(`✅ Redis キャッシュヒット (${cacheTime.toFixed(2)}ms):`, cachedTodos.length, '件')
        
        const response = NextResponse.json(cachedTodos.map(todo => ({
          ...todo,
          dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : null,
          createdAt: new Date(todo.createdAt).toISOString(),
          updatedAt: new Date(todo.updatedAt).toISOString()
        })))
        
        const securityHeaders = createSecurityHeaders()
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        response.headers.set('X-Cache-Status', 'hit')
        response.headers.set('X-Response-Time', `${cacheTime.toFixed(2)}ms`)
        
        return response
      }
      console.log('❌ Redis キャッシュミス - Lambda API経由で取得')
    }
    
    // 🎯 最適化されたLambda ユーザー専用エンドポイントを使用
    console.log('🚀 Lambda最適化エンドポイント呼び出し:', `/todos/user/${userId}`)
    const lambdaStart = performance.now()
    
    const lambdaResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(userId)}`)
    const lambdaTime = performance.now() - lambdaStart
    
    console.log(`📡 Lambda API レスポンス (${lambdaTime.toFixed(2)}ms):`, {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      dataLength: lambdaResponse.data ? lambdaResponse.data.length : 0,
      error: lambdaResponse.error
    })
    
    if (!lambdaResponse.success || !Array.isArray(lambdaResponse.data)) {
      console.error('❌ Lambda API失敗:', lambdaResponse.error)
      return NextResponse.json([], { status: 200 })
    }
    
    // 🛡️ データサニタイズ (Date オブジェクトに変換)
    const safeTodos = lambdaResponse.data.map((todo: any) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description || null,
      completed: Boolean(todo.completed),
      priority: todo.priority || 'MEDIUM',
      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
      createdAt: new Date(todo.createdAt),
      updatedAt: new Date(todo.updatedAt),
      userId: todo.userId,
      category: todo.category || null,
      tags: Array.isArray(todo.tags) ? todo.tags : []
    }))
    
    // ⚡ 高速キャッシュ保存 (非同期)
    if (safeTodos.length >= 0) {
      const cacheStartTime = performance.now()
      
      // 非同期でキャッシュ保存（レスポンス速度に影響しない）
      CacheManager.setTodos(userId, safeTodos, 300).then(() => {
        const cacheTime = performance.now() - cacheStartTime
        console.log(`💾 キャッシュ保存完了 (${cacheTime.toFixed(2)}ms):`, safeTodos.length, '件')
      }).catch(error => {
        console.log('⚠️ キャッシュ保存失敗:', error.message)
      })
    }
    
    const totalTime = performance.now() - startTime
    const performanceLevel = totalTime < 500 ? '🟢 高速' : 
                            totalTime < 800 ? '🟡 普通' : '🔴 要改善'
    
    console.log(`✅ ユーザー専用Todo取得完了 (${totalTime.toFixed(2)}ms) ${performanceLevel}:`, {
      todoCount: safeTodos.length,
      lambdaTime: lambdaTime.toFixed(2) + 'ms',
      performance: performanceLevel
    })
    
    // JSON レスポンス用のデータ変換 (日付を文字列に)
    const responseData = safeTodos.map(todo => ({
      ...todo,
      dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
      createdAt: todo.createdAt.toISOString(),
      updatedAt: todo.updatedAt.toISOString()
    }))
    
    // セキュリティヘッダー設定
    const apiResponse = NextResponse.json(responseData)
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      apiResponse.headers.set(key, value)
    })
    apiResponse.headers.set('X-Cache-Status', 'miss')
    apiResponse.headers.set('X-Response-Time', `${totalTime.toFixed(2)}ms`)
    apiResponse.headers.set('X-Lambda-Time', `${lambdaTime.toFixed(2)}ms`)
    
    return apiResponse
    
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(`❌ ユーザー専用Todo取得エラー (${totalTime.toFixed(2)}ms):`, error)
    
    return NextResponse.json([], { status: 200 })
  }
}