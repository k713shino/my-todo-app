import { NextRequest, NextResponse } from 'next/server';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { prisma } from '@/lib/prisma';
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

    // Lambda APIを使用してTodoを取得（全件取得してからフィルタリング）
    try {
      const allTodos = await lambdaAPI.getTodos();
      
      // ユーザー固有のTodoをフィルタリング
      const userTodos = allTodos.filter(todo => todo.userId === session.user.id);

      const response: VercelAPIResponse<Todo[]> = {
        success: true,
        message: `${userTodos.length}件のTodoを取得しました`,
        lambdaResponse: userTodos,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response);

    } catch (lambdaError) {
      console.error('Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda APIが失敗した場合は、ローカルPrismaから取得
      const dbTodos = await prisma.todo.findMany({
        where: {
          userId: session.user.id
        },
        orderBy: [
          { completed: 'asc' },
          { priority: 'desc' },
          { updatedAt: 'desc' }
        ]
      });

      // Prismaの結果を基本Todo型に変換
      const todos: Todo[] = dbTodos.map(todo => ({
        id: todo.id,
        title: todo.title,
        description: todo.description ?? undefined,
        completed: todo.completed,
        userId: todo.userId,
        createdAt: todo.createdAt.toISOString(),
        updatedAt: todo.updatedAt.toISOString()
      }));

      const response: VercelAPIResponse<Todo[]> = {
        success: true,
        message: `${todos.length}件のTodoを取得しました（ローカルDB）`,
        lambdaResponse: todos,
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

    // Lambda APIを最初に試行
    try {
      const todoData = {
        title: body.title,
        description: body.description || undefined,
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

    } catch (lambdaError) {
      console.error('Lambda API呼び出しエラー:', lambdaError);
      
      // Lambda APIが失敗した場合は、ローカルPrismaに保存
      const newTodo = await prisma.todo.create({
        data: {
          title: body.title,
          description: body.description || null,
          priority: body.priority || 'MEDIUM',
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          userId: session.user.id,
          category: body.category || null,
          completed: false
        }
      });

      // Prismaの結果を基本Todo型に変換
      const todo: Todo = {
        id: newTodo.id,
        title: newTodo.title,
        description: newTodo.description ?? undefined,
        completed: newTodo.completed,
        userId: newTodo.userId,
        createdAt: newTodo.createdAt.toISOString(),
        updatedAt: newTodo.updatedAt.toISOString()
      };

      const response: VercelAPIResponse<Todo> = {
        success: true,
        message: 'Todoを作成しました（ローカルDB）',
        lambdaResponse: todo,
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

