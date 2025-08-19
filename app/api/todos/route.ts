import { NextRequest, NextResponse } from 'next/server';
import { Priority } from '@prisma/client';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { getAuthenticatedUser, createAuthErrorResponse, createSecurityHeaders } from '@/lib/auth-utils';
import type { Todo } from '@/types/todo';
import { safeToISOString } from '@/lib/date-utils';
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization';
import { CacheManager } from '@/lib/cache';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得
export async function GET(request: NextRequest) {
  // 🛡️ セキュリティ強化: 厳格な認証チェック
  const authResult = await getAuthenticatedUser(request)
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }

  // Lambda最適化の適用
  await optimizeForLambda();
  
  return measureLambdaPerformance('GET /api/todos', async () => {
    try {
      console.log('🚀 フロントエンドAPI GET /api/todos 呼び出し開始 - Redis対応版');
      console.log('👤 認証済みユーザー:', {
        userId: authResult.user!.id,
        email: authResult.user!.email
      });
      
      // キャッシュバイパスチェック
      const { searchParams } = new URL(request.url)
      const bypassCache = searchParams.get('cache') === 'false'
      
      // Redisキャッシュから取得を試行
      let cachedTodos = null
      if (!bypassCache) {
        console.log('📦 Redis キャッシュからTodoを取得試行中...')
        cachedTodos = await CacheManager.getTodos(authResult.user!.id)
        if (cachedTodos) {
          console.log('✅ Redis キャッシュヒット:', cachedTodos.length, '件')
          const response = NextResponse.json(cachedTodos)
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
      
      // 🚀 最適化されたユーザー専用エンドポイント使用
      console.log('🚀 Lambda最適化エンドポイント呼び出し:', `/todos/user/${authResult.user!.id}`)
      const lambdaResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(authResult.user!.id)}`)
      
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
          completed: Boolean(todo.completed),
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
  });
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

    const todoData = {
      title: body.title,
      description: body.description || undefined,
      userId: session.user.id,
      userEmail: session.user.email || undefined,
      userName: session.user.name || undefined,
      priority: body.priority || 'MEDIUM',
      dueDate: body.dueDate || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined
    };
    
    // 🚀 高速Todo作成: ヘルスチェックをスキップして直接作成
    
    // Lambda API経由でTodoを作成
    try {
      const lambdaStart = performance.now()
      const lambdaResponse = await lambdaAPI.post('/todos', todoData)
      const lambdaTime = performance.now() - lambdaStart
      
      if (lambdaResponse.success && lambdaResponse.data) {
        const responseData = lambdaResponse.data
        
        // レスポンスデータの安全な日付変換
        const newTodo = {
          ...responseData,
          createdAt: safeToISOString(responseData.createdAt),
          updatedAt: safeToISOString(responseData.updatedAt),
          dueDate: responseData.dueDate ? safeToISOString(responseData.dueDate) : null,
          priority: responseData.priority || 'MEDIUM',
          category: responseData.category || null,
          tags: responseData.tags || []
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

// Todoを更新
export async function PUT(request: NextRequest) {
  try {
    console.log('🚀 フロントエンドAPI PUT /api/todos 呼び出し開始');
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // URLからTodoIDを取得
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const todoId = pathSegments[pathSegments.length - 1];

    console.log('PUT request details:', { todoId, pathSegments });

    if (!todoId) {
      return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 });
    }

    let body: any;
    try {
      body = await request.json();
      console.log('📥 PUT リクエストボディ:', body);
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    try {
      console.log('📞 Lambda PUT /todos/{id} 呼び出し開始...');
      const lambdaResponse = await lambdaAPI.put(`/todos/${todoId}`, body);
      console.log('📡 Lambda API 更新レスポンス:', {
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        error: lambdaResponse.error
      });
      
      if (lambdaResponse.success && lambdaResponse.data) {
        const responseData = lambdaResponse.data;
        
        const updatedTodo = {
          ...responseData,
          createdAt: safeToISOString(responseData.createdAt),
          updatedAt: safeToISOString(responseData.updatedAt),
          dueDate: responseData.dueDate ? safeToISOString(responseData.dueDate) : null,
          priority: responseData.priority || 'MEDIUM',
          category: responseData.category || null,
          tags: responseData.tags || []
        };
        
        console.log('✅ Todo更新成功:', updatedTodo.id);
        
        // キャッシュ無効化
        try {
          await CacheManager.invalidateUserTodos(session.user.id)
          console.log('📦 キャッシュ無効化完了')
        } catch (cacheError) {
          console.log('⚠️ キャッシュ無効化失敗:', cacheError)
        }
        
        return NextResponse.json(updatedTodo, { status: 200 });
        
      } else {
        console.error('❌ Lambda API でのTodo更新失敗:', lambdaResponse.error);
        return NextResponse.json({ 
          error: 'Failed to update todo',
          details: lambdaResponse.error
        }, { status: 500 });
      }
      
    } catch (apiError) {
      console.error('❌ Lambda API呼び出しで例外:', apiError);
      return NextResponse.json({ 
        error: 'Failed to update todo',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Todo更新処理で例外発生:', error);
    return NextResponse.json({ 
      error: 'Internal server error during todo update',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Todoを削除
export async function DELETE(request: NextRequest) {
  try {
    console.log('🚀 フロントエンドAPI DELETE /api/todos 呼び出し開始');
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // URLからTodoIDを取得
    const url = new URL(request.url);
    const pathSegments = url.pathname.split('/');
    const todoId = pathSegments[pathSegments.length - 1];

    console.log('DELETE request details:', { todoId, pathSegments, userId: session.user.id });

    if (!todoId) {
      return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 });
    }

    try {
      console.log('📞 Lambda DELETE /todos/{id} 呼び出し開始...');
      // Lambda API経由でTodoを削除 (userIdをクエリパラメータで送信、TEXT型対応)
      const lambdaResponse = await lambdaAPI.delete(`/todos/${todoId}?userId=${encodeURIComponent(session.user.id)}`);
      console.log('📡 Lambda API 削除レスポンス:', {
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        error: lambdaResponse.error
      });
      
      if (lambdaResponse.success) {
        console.log('✅ Todo削除成功:', todoId);
        
        // キャッシュ無効化
        try {
          await CacheManager.invalidateUserTodos(session.user.id)
          console.log('📦 キャッシュ無効化完了')
        } catch (cacheError) {
          console.log('⚠️ キャッシュ無効化失敗:', cacheError)
        }
        
        return NextResponse.json({ message: 'Todo deleted successfully' }, { status: 200 });
        
      } else {
        console.error('❌ Lambda API でのTodo削除失敗:', lambdaResponse.error);
        // 404エラーの場合は適切なステータスコードを返す
        const status = lambdaResponse.error?.includes('not found') ? 404 : 500;
        return NextResponse.json({ 
          error: 'Failed to delete todo',
          details: lambdaResponse.error
        }, { status });
      }
      
    } catch (apiError) {
      console.error('❌ Lambda API呼び出しで例外:', apiError);
      return NextResponse.json({ 
        error: 'Failed to delete todo',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Todo削除処理で例外発生:', error);
    return NextResponse.json({ 
      error: 'Internal server error during todo deletion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}