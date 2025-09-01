import { NextRequest, NextResponse } from 'next/server';
import { Priority, Status } from '@prisma/client';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { getAuthenticatedUser, createAuthErrorResponse, createSecurityHeaders } from '@/lib/auth-utils';
import type { Todo } from '@/types/todo';
import { safeToISOString } from '@/lib/date-utils';
import { CacheManager } from '@/lib/cache';
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得（ユーザー専用最適化版）
export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request)
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }

  try {
    console.log('🚀 高速Todo取得開始 - ユーザー専用エンドポイント使用');
    
    // キャッシュバイパスチェック
    const { searchParams } = new URL(request.url)
    const bypassCache = searchParams.get('cache') === 'false'
    
    // Redisキャッシュから取得を試行
    if (!bypassCache) {
      console.log('📦 Redis キャッシュからTodoを取得試行中...')
      const cachedTodos = await CacheManager.getTodos(authResult.user!.id)
      if (cachedTodos) {
        console.log('✅ Redis キャッシュヒット:', cachedTodos.length, '件')
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
        return response
      } else {
        console.log('❌ Redis キャッシュミス - Lambda API経由で取得')
      }
    } else {
      console.log('🔄 キャッシュバイパス指定 - Lambda API経由で取得')
    }
    
    // 🚀 最適化されたユーザー専用エンドポイント使用（認証方法別ユーザーID変換）
    const actualUserId = extractUserIdFromPrefixed(authResult.user!.id)
    console.log('🚀 Lambda最適化エンドポイント呼び出し:', `/todos/user/${actualUserId} (元ID: ${authResult.user!.id})`)
    const lambdaResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(actualUserId)}`)
    
    console.log('📡 Lambda API レスポンス:', {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      dataLength: lambdaResponse.data ? lambdaResponse.data.length : 0,
      error: lambdaResponse.error
    })
    
    if (lambdaResponse.success && Array.isArray(lambdaResponse.data)) {
      // 🛡️ データサニタイズ (Date オブジェクトに変換)
      const safeTodos = lambdaResponse.data.map((todo: any) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description || null,
        status: todo.status || (todo.completed ? 'DONE' : 'TODO'), // statusを優先、後方互換性でcompletedも変換
        priority: todo.priority || 'MEDIUM',
        dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt),
        userId: todo.userId,
        category: todo.category || null,
        tags: Array.isArray(todo.tags) ? todo.tags : []
      }))
      
      console.log('✅ Todo取得成功:', safeTodos.length, '件')
      
      // 🛡️ Redisキャッシュに保存 (5分間キャッシュ)
      if (safeTodos.length >= 0) {
        try {
          await CacheManager.setTodos(authResult.user!.id, safeTodos, 300)
          console.log('📦 Redis キャッシュに保存完了:', safeTodos.length, '件')
        } catch (cacheError) {
          console.log('⚠️ Redis キャッシュ保存失敗:', cacheError)
        }
      }
      
      // JSON レスポンス用のデータ変換 (日付を文字列に)
      const responseData = safeTodos.map(todo => ({
        ...todo,
        dueDate: todo.dueDate ? todo.dueDate.toISOString() : null,
        createdAt: todo.createdAt.toISOString(),
        updatedAt: todo.updatedAt.toISOString()
      }))
      
      // 🛡️ セキュリティヘッダーを追加
      const response = NextResponse.json(responseData)
      const securityHeaders = createSecurityHeaders()
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      response.headers.set('X-Cache-Status', 'miss')
      
      return response
      
    } else {
      console.log('⚠️ Lambda API 失敗:', lambdaResponse.error)
      return NextResponse.json([], { status: 200 })
    }

  } catch (error) {
    console.error('❌ Todo取得で例外発生:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    // ネットワークエラーやその他の例外でも空配列を返す
    return NextResponse.json([], { status: 200 });
  }
}

// 新しいTodoを作成
export async function POST(request: NextRequest) {
  const startTime = performance.now()
  
  try {
    console.log('🚀 高速Todo作成開始')
    
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    // バリデーション
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // 認証方法別ユーザーID変換
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    
    const todoData = {
      title: body.title,
      description: body.description || undefined,
      userId: actualUserId, // 実際のユーザーIDを使用
      userEmail: session.user.email || undefined,
      userName: session.user.name || undefined,
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
      dueDate: body.dueDate || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined
    };
    
    // Lambda API経由でTodoを作成
    try {
      const lambdaStart = performance.now()
      const lambdaResponse = await lambdaAPI.post('/todos', todoData)
      const lambdaTime = performance.now() - lambdaStart
      
      if (lambdaResponse.success && lambdaResponse.data) {
        const responseData = lambdaResponse.data
        
        // レスポンスデータの安全な日付変換
        // タグ正規化（CSV/配列両対応）
        const normalizedTags = Array.isArray(responseData.tags)
          ? responseData.tags
          : (typeof responseData.tags === 'string'
              ? responseData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
              : [])

        const newTodo = {
          ...responseData,
          createdAt: safeToISOString(responseData.createdAt),
          updatedAt: safeToISOString(responseData.updatedAt),
          dueDate: responseData.dueDate ? safeToISOString(responseData.dueDate) : null,
          priority: responseData.priority || 'MEDIUM',
          category: responseData.category || null,
          tags: normalizedTags
        }
        
        // キャッシュ無効化（非同期）
        CacheManager.invalidateUserTodos(session.user.id).catch(() => {})
        
        const totalTime = performance.now() - startTime
        const performanceLevel = totalTime < 500 ? '🟢 高速' : 
                                totalTime < 1000 ? '🟡 普通' : '🔴 要改善'
        
        console.log(`✅ Todo作成完了 (${totalTime.toFixed(2)}ms) ${performanceLevel}:`, {
          id: newTodo.id,
          lambdaTime: lambdaTime.toFixed(2) + 'ms'
        })
        
        return NextResponse.json(newTodo, { status: 201 })
        
      } else {
        return NextResponse.json({ 
          error: 'Failed to create todo',
          details: lambdaResponse.error
        }, { status: 500 })
      }
      
    } catch (apiError) {
      return NextResponse.json({ 
        error: 'Failed to create todo',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 })
    }

  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(`❌ Todo作成エラー (${totalTime.toFixed(2)}ms):`, error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ 
      error: 'Internal server error during todo creation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
