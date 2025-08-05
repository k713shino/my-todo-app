import { NextRequest, NextResponse } from 'next/server';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import type { 
  VercelAPIResponse, 
  Todo, 
  CreateTodoRequest 
} from '@/types/lambda-api';

// 全てのTodoを取得
export async function GET(request: NextRequest): Promise<NextResponse<VercelAPIResponse<Todo[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    let todos: Todo[];
    
    if (userId) {
      // 特定ユーザーのTodoを取得
      todos = await lambdaAPI.getUserTodos(userId);
    } else {
      // 全てのTodoを取得
      todos = await lambdaAPI.getTodos();
    }

    const response: VercelAPIResponse<Todo[]> = {
      success: true,
      message: `${todos.length}件のTodoを取得しました`,
      lambdaResponse: todos,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Todo取得エラー:', error);
    
    const errorResponse: VercelAPIResponse = {
      success: false,
      error: formatLambdaAPIError(error),
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// 新しいTodoを作成
export async function POST(request: NextRequest): Promise<NextResponse<VercelAPIResponse<Todo>>> {
  try {
    const body: CreateTodoRequest = await request.json();
    
    // バリデーション
    if (!body.title || !body.userId) {
      return NextResponse.json({
        success: false,
        error: 'Title and userId are required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const newTodo = await lambdaAPI.createTodo(body);

    const response: VercelAPIResponse<Todo> = {
      success: true,
      message: 'Todoを作成しました',
      lambdaResponse: newTodo,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('❌ Todo作成エラー:', error);
    
    const errorResponse: VercelAPIResponse = {
      success: false,
      error: formatLambdaAPIError(error),
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

