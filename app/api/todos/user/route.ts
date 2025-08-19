/**
 * 最適化されたユーザー専用Todo取得API
 * パフォーマンス改善のための専用エンドポイント
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-utils'
import { createAuthErrorResponse } from '@/lib/auth-utils'
import { CacheManager } from '@/lib/cache'
import { lambdaAPI } from '@/lib/lambda-api'
import { createSecurityHeaders } from '@/lib/security'
import { measureLambdaPerformance, optimizeForLambda } from '@/lib/lambda-utils'
import { safeToISOString } from '@/lib/date-utils'

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request)
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }

  await optimizeForLambda()
  
  return measureLambdaPerformance('GET /api/todos/user', async () => {
    try {
      console.log('🚀 最適化されたユーザー専用Todo取得 API開始')
      console.log('👤 認証済みユーザー:', { 
        userId: authResult.user!.id, 
        email: authResult.user!.email 
      })
      
      const userId = authResult.user!.id
      const { searchParams } = new URL(request.url)
      const bypassCache = searchParams.get('cache') === 'false'
      
      // ⚡ 高速キャッシュチェック
      if (!bypassCache) {
        console.log('⚡ Redis高速キャッシュチェック開始')
        const startTime = Date.now()
        
        const cachedTodos = await CacheManager.getTodos(userId)
        const cacheTime = Date.now() - startTime
        
        if (cachedTodos) {
          console.log(`✅ キャッシュヒット! (${cacheTime}ms)`, {
            todoCount: cachedTodos.length,
            performance: cacheTime < 100 ? '🟢 高速' : cacheTime < 300 ? '🟡 普通' : '🔴 遅い'
          })
          
          const response = NextResponse.json(cachedTodos)
          const securityHeaders = createSecurityHeaders()
          Object.entries(securityHeaders).forEach(([key, value]) => {
            response.headers.set(key, value)
          })
          response.headers.set('X-Cache-Status', 'hit')
          response.headers.set('X-Response-Time', `${cacheTime}ms`)
          return response
        }
        
        console.log(`⚠️ キャッシュミス (${cacheTime}ms) - データベースから取得`)
      }
      
      // 🎯 ユーザー専用Lambda APIエンドポイント使用
      console.log('🎯 Lambda API - ユーザー専用エンドポイント呼び出し')
      const apiStartTime = Date.now()
      
      const response = await lambdaAPI.getUserTodos(userId)
      const apiTime = Date.now() - apiStartTime
      
      console.log(`📡 Lambda APIレスポンス (${apiTime}ms):`, {
        todoCount: Array.isArray(response) ? response.length : 0,
        performance: apiTime < 500 ? '🟢 高速' : apiTime < 1500 ? '🟡 普通' : '🔴 遅い'
      })
      
      if (!Array.isArray(response)) {
        console.error('❌ Lambda API: 無効なレスポンス形式')
        return NextResponse.json([], { status: 200 })
      }
      
      // 🛡️ データサニタイズ (高速化)
      const safeTodos = response.map((todo: any) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description || null,
        completed: Boolean(todo.completed),
        priority: todo.priority || 'MEDIUM',
        dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
        createdAt: safeToISOString(todo.createdAt),
        updatedAt: safeToISOString(todo.updatedAt),
        userId: todo.userId,
        category: todo.category || null,
        tags: Array.isArray(todo.tags) ? todo.tags : []
      }))
      
      // ⚡ 高速キャッシュ保存 (非同期)
      if (safeTodos.length > 0) {
        const cacheStartTime = Date.now()
        
        // 非同期でキャッシュ保存（レスポンス速度に影響しない）
        CacheManager.setTodos(userId, safeTodos, 300).then(() => {
          const cacheTime = Date.now() - cacheStartTime
          console.log(`💾 キャッシュ保存完了 (${cacheTime}ms):`, safeTodos.length, '件')
        }).catch(error => {
          console.log('⚠️ キャッシュ保存失敗:', error.message)
        })
      }
      
      const totalTime = Date.now() - (request as any).startTime || 'unknown'
      console.log(`✅ Todo取得完了 (合計: ${totalTime}ms):`, {
        todoCount: safeTodos.length,
        cacheUsed: !bypassCache,
        performance: typeof totalTime === 'number' && totalTime < 800 ? '🟢 高速' : '🟡 改善余地あり'
      })
      
      // セキュリティヘッダー設定
      const apiResponse = NextResponse.json(safeTodos)
      const securityHeaders = createSecurityHeaders()
      Object.entries(securityHeaders).forEach(([key, value]) => {
        apiResponse.headers.set(key, value)
      })
      apiResponse.headers.set('X-Cache-Status', 'miss')
      apiResponse.headers.set('X-Response-Time', `${typeof totalTime === 'number' ? totalTime : 'unknown'}ms`)
      
      return apiResponse
      
    } catch (error) {
      console.error('❌ ユーザー専用Todo取得エラー:', error)
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      
      return NextResponse.json([], { status: 200 })
    }
  })
}