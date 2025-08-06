import { NextRequest, NextResponse } from 'next/server';
import { Priority } from '@prisma/client';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import type { Todo } from '@/types/todo';
import type { VercelAPIResponse } from '@/types/lambda-api';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json([], { status: 200 });
    }

    try {
      // Lambda APIからTodoを取得
      console.log('🚀 Lambda APIからTodoを取得中...');
      const lambdaTodos = await lambdaAPI.getTodos();
      
      // Lambda APIのレスポンス形式を確認し、適切に変換
      let todos: Todo[];
      
      if (Array.isArray(lambdaTodos)) {
        // Lambda APIから取得したデータをTodo型に変換（日付フィールドを安全に処理）
        todos = lambdaTodos.map(todo => {
          // 日付フィールドの安全な変換関数
          const safeToISOString = (dateValue: any): string => {
            if (!dateValue) return new Date().toISOString();
            try {
              const date = new Date(dateValue);
              if (isNaN(date.getTime())) {
                return new Date().toISOString();
              }
              return date.toISOString();
            } catch {
              return new Date().toISOString();
            }
          };

          return {
            id: todo.id?.toString() || `lambda-${Date.now()}`,
            title: todo.title || 'Untitled',
            description: todo.description || undefined,
            completed: Boolean(todo.completed),
            priority: Priority.MEDIUM, // Lambda APIにはpriorityがないため中優先度を設定
            category: undefined,
            tags: [],
            dueDate: null, // Lambda APIにはdueDateがないためnull
            userId: session.user.id,
            createdAt: new Date(safeToISOString(todo.createdAt)),
            updatedAt: new Date(safeToISOString(todo.updatedAt))
          };
        });
      } else {
        todos = [];
      }

      console.log('✅ Lambda APIからのTodo取得成功:', todos.length, '件');
      return NextResponse.json(todos);

    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda API失敗時のフォールバック（モックデータ）
      const mockTodos: Todo[] = [
        {
          id: 'fallback-1',
          title: 'Lambda API接続エラー',
          description: 'Lambda APIとの接続に問題があります。フォールバックデータを表示中。',
          completed: false,
          priority: Priority.MEDIUM,
          category: undefined,
          tags: [],
          dueDate: null,
          userId: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      return NextResponse.json(mockTodos);
    }

  } catch (error) {
    console.error('❌ Todo取得エラー:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// 新しいTodoを作成
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await request.json();
    
    // バリデーション
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
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
      
      // デバッグ: Lambda APIのレスポンスをログ出力
      console.log('📝 Lambda API レスポンス:', JSON.stringify(lambdaResponse, null, 2));
      
      // Lambda APIのレスポンスからTodoオブジェクトを抽出
      let newTodo: Todo;
      
      // 日付フィールドの安全な変換関数
      const safeToISOString = (dateValue: any): string => {
        if (!dateValue) return new Date().toISOString();
        try {
          const date = new Date(dateValue);
          if (isNaN(date.getTime())) {
            return new Date().toISOString();
          }
          return date.toISOString();
        } catch {
          return new Date().toISOString();
        }
      };

      if (lambdaResponse?.todo) {
        // Lambda APIが { message: "...", todo: {...} } 形式で返す場合
        const lambdaTodo = lambdaResponse.todo;
        newTodo = {
          id: lambdaTodo.id?.toString() || `lambda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: lambdaTodo.title || body.title,
          description: lambdaTodo.description || body.description || undefined,
          completed: Boolean(lambdaTodo.completed || false),
          priority: (body.priority || Priority.MEDIUM) as Priority,
          category: body.category || undefined,
          tags: body.tags || [],
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          userId: session.user.id,
          createdAt: new Date(safeToISOString(lambdaTodo.createdAt)),
          updatedAt: new Date(safeToISOString(lambdaTodo.updatedAt))
        };
      } else {
        // Lambda APIが直接Todoオブジェクトを返す場合（通常はこちら）
        newTodo = {
          id: lambdaResponse.id?.toString() || `lambda-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: lambdaResponse.title || body.title,
          description: lambdaResponse.description || body.description || undefined,
          completed: Boolean(lambdaResponse.completed || false),
          priority: (body.priority || Priority.MEDIUM) as Priority,
          category: body.category || undefined,
          tags: body.tags || [],
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          userId: session.user.id,
          createdAt: new Date(safeToISOString(lambdaResponse.createdAt)),
          updatedAt: new Date(safeToISOString(lambdaResponse.updatedAt))
        };
      }

      console.log('✅ Lambda APIでのTodo作成成功:', newTodo.id);
      return NextResponse.json(newTodo, { status: 201 });

    } catch (lambdaError) {
      console.error('❌ Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda API失敗時のフォールバック（モックデータ）
      const mockTodo: Todo = {
        id: `fallback-${Date.now()}`,
        title: body.title,
        description: body.description || 'Lambda API接続エラーのため、ローカルで作成されました',
        completed: false,
        priority: (body.priority || Priority.MEDIUM) as Priority,
        category: body.category || undefined,
        tags: body.tags || [],
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        userId: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return NextResponse.json(mockTodo, { status: 201 });
    }

  } catch (error) {
    console.error('❌ Todo作成エラー:', error);
    return NextResponse.json({ error: 'Todo作成に失敗しました' }, { status: 500 });
  }
}

