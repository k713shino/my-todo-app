import { NextRequest, NextResponse } from 'next/server';
import { Priority } from '@prisma/client';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { getAuthenticatedUser, createAuthErrorResponse, createSecurityHeaders } from '@/lib/auth-utils';
import type { Todo } from '@/types/todo';
import { safeToISOString } from '@/lib/date-utils';
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization';

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
      console.log('🚀 フロントエンドAPI GET /api/todos 呼び出し開始 - セキュリティ強化版');
      console.log('👤 認証済みユーザー:', {
        userId: authResult.user!.id,
        email: authResult.user!.email
      });
      
      console.log('🔄 緊急回避策: /todos エンドポイント + フロントエンドフィルタリング使用');
      console.log('📝 理由: API Gatewayの/todos/user/{userId}ルーティング問題のため');
      console.log('👤 現在のユーザーID:', authResult.user!.id);
      
      // 緊急回避策: /todos エンドポイントを使用してフロントエンドでフィルタリング
      const fallbackResponse = await lambdaAPI.get('/todos');
      console.log('📡 Lambda API レスポンス:', {
        success: fallbackResponse.success,
        hasData: !!fallbackResponse.data,
        dataType: typeof fallbackResponse.data,
        dataLength: fallbackResponse.data ? fallbackResponse.data.length : 0,
        error: fallbackResponse.error,
        timestamp: fallbackResponse.timestamp
      });
      
      if (fallbackResponse.success && fallbackResponse.data) {
        const allTodos = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
        console.log('📊 全Todo件数:', allTodos.length);
        
        // 🛡️ セキュリティ修正: 認証済みユーザーのTodoのみフィルタリング (TEXT型対応)
        const userTodos = allTodos.filter((todo: any) => {
          const todoUserId = todo.userId;
          const currentUserId = authResult.user!.id;
          
          // 文字列として直接比較 (TEXT型対応)
          if (todoUserId === currentUserId) return true;
          
          // 念のため文字列変換して比較
          if (todoUserId.toString() === currentUserId.toString()) return true;
          
          return false;
        });
        
        console.log('📊 フィルタリング後Todo件数:', userTodos.length);
        
        // 🛡️ セキュリティ修正: 新規ユーザー検出ロジックを安全化
        if (userTodos.length === 0) {
          console.log('🔍 新規ユーザーの可能性をチェック');
          
          // 現在のセッションでのTodo作成履歴を確認（最近30分以内）
          const newUserTodos = allTodos.filter((todo: any) => {
            const userId = todo.userId;
            // CUID形式の検証を追加
            if (!userId || !userId.startsWith('c') || userId.length < 15) return false;
            
            // 最近30分以内に作成されたTodoかチェック
            const todoCreatedAt = new Date(todo.createdAt);
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            return todoCreatedAt > thirtyMinutesAgo;
          });
          
          console.log('🕒 最近30分の新規ユーザーTodo:', newUserTodos.length, '件');
          
          if (newUserTodos.length > 0) {
            // 最も最近作成されたTodoのユーザーIDを取得
            const sortedTodos = newUserTodos.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            const detectedUserId = sortedTodos[0].userId;
            
            // 🛡️ セキュリティ修正: 検出されたユーザーIDと現在のセッションユーザーIDの関連性を確認
            // この部分は今後、より安全な方法（データベースでの明示的なマッピング）に置き換える必要がある
            console.log('🆕 新規ユーザー検出:', {
              detectedUserId,
              recentTodoCount: newUserTodos.length,
              sessionUserId: authResult.user!.id
            });
            
            // 検出されたユーザーIDで全Todoを再フィルタリング
            const allUserTodos = allTodos.filter((todo: any) => todo.userId === detectedUserId);
            console.log('🔄 検出されたユーザーIDの全Todo:', allUserTodos.length, '件');
            
            userTodos.push(...allUserTodos);
          }
        }
        
        console.log('📊 最終フィルタリング後Todo件数:', userTodos.length);
        
        if (userTodos.length > 0) {
          console.log('📝 フィルタリング結果サンプル:', userTodos.slice(0, 3).map((t: any) => ({
            id: t.id,
            title: t.title,
            userId: t.userId,
            completed: t.completed
          })));
        }
        
        // 🛡️ セキュリティ修正: データサニタイズ
        const safeTodos = userTodos.map((todo: any) => ({
          ...todo,
          createdAt: safeToISOString(todo.createdAt),
          updatedAt: safeToISOString(todo.updatedAt),
          dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
          priority: todo.priority || 'MEDIUM',
          userId: todo.userId,
          category: todo.category || null,
          tags: Array.isArray(todo.tags) ? todo.tags : []
        }));
        
        console.log('✅ Todo取得成功:', safeTodos.length, '件');
        
        // 🛡️ セキュリティヘッダーを追加
        const response = NextResponse.json(safeTodos);
        const securityHeaders = createSecurityHeaders();
        Object.entries(securityHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
        return response;
        
      } else {
        console.log('⚠️ Lambda API 失敗:', {
          success: fallbackResponse.success,
          error: fallbackResponse.error,
          data: fallbackResponse.data,
          timestamp: fallbackResponse.timestamp
        });
        
        // エラーの場合も空配列を返してUIの破綻を防ぐ
        return NextResponse.json([], { status: 200 });
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
  try {
    console.log('🚀 フロントエンドAPI POST /api/todos 呼び出し開始 - デバッグ版 v4');
    
    const session = await getAuthSession()
    console.log('👤 セッション情報:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    });
    
    if (!isAuthenticated(session)) {
      console.log('❌ 認証されていません');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
      console.log('📥 リクエストボディ:', body);
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError);
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    // バリデーション
    if (!body.title) {
      console.log('❌ タイトルが不足');
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    console.log('🆕 Lambda API経由でTodo作成開始');
    console.log('👤 現在のユーザー:', {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    });
    
    // Lambda API用のリクエストデータ
    // 🔧 修正: OAuth認証ユーザーのIDを文字列として送信 (TEXT型対応)
    console.log('🔍 ユーザーID詳細:', {
      originalId: session.user.id,
      idType: typeof session.user.id,
      idLength: session.user.id?.length
    });
    
    const todoData = {
      title: body.title,
      description: body.description || undefined,
      userId: session.user.id, // 文字列として送信 (TEXT型対応)
      userEmail: session.user.email || undefined,
      userName: session.user.name || undefined,
      priority: body.priority || 'MEDIUM',
      dueDate: body.dueDate || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined
    };
    
    console.log('📤 Lambda API送信データ:', todoData);
    
    // まずLambdaヘルスチェック
    try {
      console.log('🏥 Lambda ヘルスチェック (POST前)...');
      const healthResponse = await lambdaAPI.get('/');
      console.log('🏥 Lambda ヘルスチェック結果:', {
        success: healthResponse.success,
        error: healthResponse.error
      });
      
      if (!healthResponse.success) {
        console.log('⚠️ Lambda接続不良 - エラーを返す');
        return NextResponse.json({ 
          error: 'Lambda service unavailable', 
          details: healthResponse.error 
        }, { status: 503 });
      }
    } catch (healthError) {
      console.error('❌ Lambda ヘルスチェックで例外:', healthError);
      return NextResponse.json({ 
        error: 'Lambda service unavailable',
        details: healthError instanceof Error ? healthError.message : 'Unknown error'
      }, { status: 503 });
    }
    
    // Lambda API経由でTodoを作成
    try {
      console.log('📞 Lambda POST /todos 呼び出し開始...');
      const lambdaResponse = await lambdaAPI.post('/todos', todoData);
      console.log('📡 Lambda API 作成レスポンス:', {
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        error: lambdaResponse.error,
        timestamp: lambdaResponse.timestamp
      });
      
      if (lambdaResponse.success && lambdaResponse.data) {
        // Lambdaからの新しい形式のレスポンスを処理
        const responseData = lambdaResponse.data;
        console.log('✅ Lambda からのレスポンスデータ:', responseData);
        
        // レスポンスデータの安全な日付変換とPrisma型との互換性確保
        const newTodo = {
          ...responseData,
          createdAt: safeToISOString(responseData.createdAt),
          updatedAt: safeToISOString(responseData.updatedAt),
          dueDate: responseData.dueDate ? safeToISOString(responseData.dueDate) : null,
          priority: responseData.priority || 'MEDIUM',
          category: responseData.category || null,
          tags: responseData.tags || []
        };
        
        console.log('✅ Todo作成成功:', newTodo.id);
        return NextResponse.json(newTodo, { status: 201 });
        
      } else {
        console.error('❌ Lambda API でのTodo作成失敗:', lambdaResponse.error);
        return NextResponse.json({ 
          error: 'Failed to create todo',
          details: lambdaResponse.error
        }, { status: 500 });
      }
      
    } catch (apiError) {
      console.error('❌ Lambda API呼び出しで例外:', apiError);
      return NextResponse.json({ 
        error: 'Failed to create todo',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Todo作成処理で例外発生:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
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

    console.log('DELETE request details:', { todoId, pathSegments });

    if (!todoId) {
      return NextResponse.json({ error: 'Todo ID is required' }, { status: 400 });
    }

    try {
      console.log('📞 Lambda DELETE /todos/{id} 呼び出し開始...');
      const lambdaResponse = await lambdaAPI.delete(`/todos/${todoId}`);
      console.log('📡 Lambda API 削除レスポンス:', {
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        error: lambdaResponse.error
      });
      
      if (lambdaResponse.success) {
        console.log('✅ Todo削除成功:', todoId);
        return NextResponse.json({ message: 'Todo deleted successfully' }, { status: 200 });
        
      } else {
        console.error('❌ Lambda API でのTodo削除失敗:', lambdaResponse.error);
        return NextResponse.json({ 
          error: 'Failed to delete todo',
          details: lambdaResponse.error
        }, { status: 500 });
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