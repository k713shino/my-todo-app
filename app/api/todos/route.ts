import { NextRequest, NextResponse } from 'next/server';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import type { 
  VercelAPIResponse, 
  Todo
} from '@/types/lambda-api';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得
export async function GET(request: NextRequest): Promise<NextResponse<VercelAPIResponse<Todo[]>>> {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    try {
      // Lambda APIからTodoを取得
      console.log('🚀 Lambda APIからTodoを取得中...');
      const lambdaTodos = await lambdaAPI.getTodos();
      
      // Lambda APIのレスポンス形式を確認し、適切に変換
      let todos: Todo[];
      
      if (Array.isArray(lambdaTodos)) {
        // Lambda APIから取得したデータをTodo型に変換
        todos = lambdaTodos.map(todo => ({
          id: todo.id.toString(),
          title: todo.title,
          description: todo.description || undefined,
          completed: todo.completed || false,
          userId: session.user.id, // セッションからユーザーIDを設定
          createdAt: todo.createdAt || new Date().toISOString(),
          updatedAt: todo.updatedAt || new Date().toISOString()
        }));
      } else {
        todos = [];
      }

      const response: VercelAPIResponse<Todo[]> = {
        success: true,
        message: `${todos.length}件のTodoを取得しました`,
        lambdaResponse: todos,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Lambda APIからのTodo取得成功:', todos.length, '件');
      return NextResponse.json(response);

    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda API失敗時のフォールバック（モックデータ）
      const mockTodos: Todo[] = [
        {
          id: 'fallback-1',
          title: 'Lambda API接続エラー',
          description: 'Lambda APIとの接続に問題があります。フォールバックデータを表示中。',
          completed: false,
          userId: session.user.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      const response: VercelAPIResponse<Todo[]> = {
        success: true,
        message: 'Lambda API接続エラー - フォールバックデータを表示',
        lambdaResponse: mockTodos,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);
    }

  } catch (error) {
    console.error('❌ Todo取得エラー:', error);
    
    const errorResponse: VercelAPIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// 新しいTodoを作成
export async function POST(request: NextRequest): Promise<NextResponse<VercelAPIResponse<Todo>>> {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    const body: any = await request.json();
    
    // バリデーション
    if (!body.title) {
      return NextResponse.json({
        success: false,
        error: 'Title is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    try {
      // Lambda APIでTodoを作成
      console.log('🚀 Lambda APIでTodo作成中...', { title: body.title });
      
      const todoData = {
        title: body.title,
        description: body.description || undefined,
        userId: session.user.id
      };

      const lambdaResponse: any = await lambdaAPI.createTodo(todoData);
      
      // Lambda APIのレスポンスからTodoオブジェクトを抽出
      let newTodo: Todo;
      
      if (lambdaResponse.todo) {
        // Lambda APIが { message: "...", todo: {...} } 形式で返す場合
        newTodo = {
          id: lambdaResponse.todo.id?.toString() || `lambda-${Date.now()}`,
          title: lambdaResponse.todo.title,
          description: lambdaResponse.todo.description || undefined,
          completed: lambdaResponse.todo.completed || false,
          userId: session.user.id,
          createdAt: lambdaResponse.todo.createdAt || new Date().toISOString(),
          updatedAt: lambdaResponse.todo.updatedAt || new Date().toISOString()
        };
      } else {
        // Lambda APIが直接Todoオブジェクトを返す場合
        newTodo = {
          id: lambdaResponse.id?.toString() || `lambda-${Date.now()}`,
          title: lambdaResponse.title || body.title,
          description: lambdaResponse.description || body.description,
          completed: lambdaResponse.completed || false,
          userId: session.user.id,
          createdAt: lambdaResponse.createdAt || new Date().toISOString(),
          updatedAt: lambdaResponse.updatedAt || new Date().toISOString()
        };
      }

      const response: VercelAPIResponse<Todo> = {
        success: true,
        message: 'Todoを作成しました',
        lambdaResponse: newTodo,
        timestamp: new Date().toISOString(),
      };

      console.log('✅ Lambda APIでのTodo作成成功:', newTodo.id);
      return NextResponse.json(response, { status: 201 });

    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda API失敗時のフォールバック（モックデータ）
      const mockTodo: Todo = {
        id: `fallback-${Date.now()}`,
        title: body.title,
        description: body.description || 'Lambda API接続エラーのため、ローカルで作成されました',
        completed: false,
        userId: session.user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response: VercelAPIResponse<Todo> = {
        success: true,
        message: 'Todo作成（Lambda API接続エラー - フォールバック）',
        lambdaResponse: mockTodo,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 201 });
    }

  } catch (error) {
    console.error('❌ Todo作成エラー:', error);
    
    const errorResponse: VercelAPIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

