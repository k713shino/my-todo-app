import { NextRequest, NextResponse } from 'next/server';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import type { 
  VercelAPIResponse, 
  Todo, 
  CreateTodoRequest 
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

    // セッションからユーザーIDを取得してユーザー固有のTodoを取得
    const todos: Todo[] = await lambdaAPI.getUserTodos(session.user.id);

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
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    const body: CreateTodoRequest = await request.json();
    
    // バリデーション
    if (!body.title) {
      return NextResponse.json({
        success: false,
        error: 'Title is required',
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // セッションからuserIdを取得してbodyに追加
    const todoData = {
      ...body,
      userId: session.user.id
    };

    const newTodo = await lambdaAPI.createTodo(todoData);

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

