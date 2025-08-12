import { NextRequest, NextResponse } from 'next/server';
import { Priority } from '@prisma/client';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import type { Todo } from '@/types/todo';
import { safeToISOString } from '@/lib/date-utils';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 フロントエンドAPI GET /api/todos 呼び出し開始 - デバッグ版 v4');
    
    const session = await getAuthSession()
    console.log('👤 セッション情報:', {
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    });
    
    if (!isAuthenticated(session)) {
      console.log('❌ 認証されていません - 空配列を返します');
      return NextResponse.json([], { status: 200 });
    }

    console.log('🔍 デバッグ: Lambda API接続テスト開始');
    console.log('👤 現在のGoogleユーザーID:', session.user.id);
    
    // まず基本的なヘルスチェックを試行
    try {
      console.log('🏥 Lambda ヘルスチェック開始...');
      const healthResponse = await lambdaAPI.get('/');
      console.log('🏥 Lambda ヘルスチェック結果:', {
        success: healthResponse.success,
        error: healthResponse.error,
        hasData: !!healthResponse.data
      });
      
      if (!healthResponse.success) {
        console.log('⚠️ Lambda ヘルスチェック失敗 - 一時的回避策に切り替え');
        return NextResponse.json([], { status: 200 });
      }
    } catch (healthError) {
      console.error('❌ Lambda ヘルスチェックで例外:', healthError);
      return NextResponse.json([], { status: 200 });
    }
    
    // ユーザー固有エンドポイントを試行
    const userSpecificEndpoint = `/todos/user/${session.user.id}`;
    console.log('📞 ユーザー固有エンドポイント呼び出し:', userSpecificEndpoint);
    
    try {
      const lambdaResponse = await lambdaAPI.get(userSpecificEndpoint);
      console.log('📡 Lambda API レスポンス:', {
        endpoint: userSpecificEndpoint,
        success: lambdaResponse.success,
        hasData: !!lambdaResponse.data,
        dataType: typeof lambdaResponse.data,
        dataLength: lambdaResponse.data ? lambdaResponse.data.length : 0,
        error: lambdaResponse.error,
        timestamp: lambdaResponse.timestamp
      });
      
      if (lambdaResponse.success && lambdaResponse.data) {
        const userTodos = Array.isArray(lambdaResponse.data) ? lambdaResponse.data : [];
        console.log('📊 ユーザー固有Todo件数:', userTodos.length);
        
        const safeTodos = userTodos.map((todo: any) => ({
          ...todo,
          createdAt: safeToISOString(todo.createdAt),
          updatedAt: safeToISOString(todo.updatedAt),
          dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
          priority: todo.priority || 'MEDIUM',
          userId: todo.userId,
          category: todo.category || null,
          tags: todo.tags || []
        }));
        
        console.log('✅ ユーザー固有Todo取得成功:', safeTodos.length, '件');
        return NextResponse.json(safeTodos);
        
      } else {
        // ユーザー固有エンドポイントが失敗した場合、一時的回避策にフォールバック
        console.log('⚠️ ユーザー固有エンドポイント失敗 - 一時的回避策にフォールバック');
        console.log('🔄 /todos エンドポイント + フロントエンドフィルタリング使用');
        
        const fallbackResponse = await lambdaAPI.get('/todos');
        console.log('📡 フォールバック Lambda API レスポンス:', {
          success: fallbackResponse.success,
          hasData: !!fallbackResponse.data,
          error: fallbackResponse.error
        });
        
        if (fallbackResponse.success && fallbackResponse.data) {
          const allTodos = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
          console.log('📊 全Todo件数:', allTodos.length);
          
          // フロントエンド側でユーザー固有のフィルタリング
          const userTodos = allTodos.filter((todo: any) => {
            const todoUserId = todo.userId;
            const currentGoogleId = session.user.id;
            
            if (todoUserId === currentGoogleId) return true;
            
            // 既知のマッピング
            if (currentGoogleId === '110701307742242924558' && todoUserId === 'cmdpi4dye0000lc04xn7yujpn') return true;
            if (currentGoogleId === '112433279481859708110' && todoUserId === 'cmdsbbogh0000l604u08lqcp4') return true;
            
            return false;
          });
          
          console.log('📊 フィルタリング後Todo件数:', userTodos.length);
          
          const safeTodos = userTodos.map((todo: any) => ({
            ...todo,
            createdAt: safeToISOString(todo.createdAt),
            updatedAt: safeToISOString(todo.updatedAt),
            dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
            priority: todo.priority || 'MEDIUM',
            userId: todo.userId,
            category: todo.category || null,
            tags: todo.tags || []
          }));
          
          console.log('✅ フォールバック Todo取得成功:', safeTodos.length, '件');
          return NextResponse.json(safeTodos);
        }
        
        console.log('❌ すべてのフォールバック失敗 - 空配列を返す');
        return NextResponse.json([], { status: 200 });
      }
      
    } catch (apiError) {
      console.error('❌ Lambda API呼び出しで例外:', apiError);
      console.log('🔄 最終フォールバック: 空配列を返す');
      return NextResponse.json([], { status: 200 });
    }

  } catch (error) {
    console.error('❌ API全体で例外発生:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json([], { status: 200 });
  }
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

