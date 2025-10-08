import { NextRequest, NextResponse } from 'next/server';


import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { getAuthenticatedUser, createAuthErrorResponse, createSecurityHeaders } from '@/lib/auth-utils';

import { safeToISOString } from '@/lib/date-utils';
import { CacheManager } from '@/lib/cache';
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils';
import { lambdaAPI } from '@/lib/lambda-api';
import type { Todo } from '@/types/todo';

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
    const lambdaResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(actualUserId)}`, { timeout: 8000 })
    
    console.log('📡 Lambda API レスポンス:', {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      dataLength: lambdaResponse.data ? (lambdaResponse.data as unknown[]).length : 0,
      error: lambdaResponse.error
    })
    
    if (lambdaResponse.success && Array.isArray(lambdaResponse.data)) {
      // 🛡️ データサニタイズ (Date オブジェクトに変換)
      const safeTodos = lambdaResponse.data.map((todo: Record<string, unknown>) => ({
        id: todo.id,
        title: todo.title,
        description: todo.description || null,
        status: todo.status || (todo.completed ? 'DONE' : 'TODO'), // statusを優先、後方互換性でcompletedも変換
        priority: todo.priority || 'MEDIUM',
        dueDate: todo.dueDate ? new Date(String(todo.dueDate)) : null,
        createdAt: new Date(String(todo.createdAt)),
        updatedAt: new Date(String(todo.updatedAt)),
        userId: todo.userId,
        category: todo.category || null,
        tags: Array.isArray(todo.tags) ? todo.tags : []
      }))
      
      console.log('✅ Todo取得成功:', safeTodos.length, '件')
      
      // 🛡️ Redisキャッシュに保存 (5分間キャッシュ)
      if (safeTodos.length >= 0) {
        try {
          await CacheManager.setTodos(authResult.user!.id, safeTodos as Todo[], 300)
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
      return NextResponse.json({
        error: 'Failed to fetch todos from upstream',
        details: lambdaResponse.error || 'Unknown error'
      }, { status: 502 })
    }

  } catch (error) {
    console.error('❌ Todo取得で例外発生:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
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
      tags: body.tags || undefined,
      externalId: body.externalId || undefined,
      externalSource: body.externalSource || undefined,
    };

    // 外部IDが与えられている場合、ユーザー内で重複がないか事前チェック
    if (todoData.externalId) {
      try {
        const existing = await lambdaAPI.getUserTodos(actualUserId) as unknown as Record<string, unknown>[]
        const conflict = Array.isArray(existing) && existing.find((t: Record<string, unknown>) => {
          const sameId = (t.externalId || null) === todoData.externalId
          // externalSource が指定されていれば一致をより厳密に
          const sameSource = (todoData.externalSource ? (t.externalSource || null) === todoData.externalSource : true)
          return sameId && sameSource
        })
        if (conflict) {
          return NextResponse.json({
            error: 'Duplicate todo by externalId',
            conflictId: conflict.id,
          }, { status: 409 })
        }
      } catch (e) {
        console.log('⚠️ 事前重複チェック失敗（継続します）:', e)
      }
    }
    
    // Lambda API経由でTodoを作成
    try {
      const lambdaStart = performance.now()
      const lambdaResponse = await lambdaAPI.post('/todos', todoData)
      const lambdaTime = performance.now() - lambdaStart
      
      if (lambdaResponse.success && lambdaResponse.data) {
        const responseData = lambdaResponse.data as Record<string, unknown>

        // レスポンスデータの安全な日付変換
        // タグ正規化（CSV/配列両対応）
        const normalizedTags = Array.isArray(responseData.tags)
          ? responseData.tags
          : (typeof responseData.tags === 'string'
              ? responseData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
              : [])

        const newTodo = {
          ...responseData,
          createdAt: safeToISOString(responseData.createdAt as Record<string, unknown>),
          updatedAt: safeToISOString(responseData.updatedAt as Record<string, unknown>),
          dueDate: responseData.dueDate ? safeToISOString(responseData.dueDate as Record<string, unknown>) : null,
          priority: responseData.priority || 'MEDIUM',
          category: responseData.category || null,
          tags: normalizedTags
        } as Record<string, unknown>

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
