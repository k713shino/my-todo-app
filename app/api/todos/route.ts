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
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json([], { status: 200 });
    }

    console.log('🔄 Lambda API経由でTodo取得を試行');
    
    // Lambda API経由でTodoを取得
    const lambdaResponse = await lambdaAPI.get('/todos');
    console.log('📥 Lambda API レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // レスポンスデータの安全な日付変換
      const todos = Array.isArray(lambdaResponse.data) ? lambdaResponse.data : [];
      const safeTodos = todos.map((todo: any) => ({
        ...todo,
        createdAt: safeToISOString(todo.createdAt),
        updatedAt: safeToISOString(todo.updatedAt),
        dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
        // Prisma型との互換性のため必要なフィールドを追加
        priority: todo.priority || 'MEDIUM',
        userId: todo.userId || session.user.id,
        category: todo.category || null,
        tags: todo.tags || []
      }));
      
      console.log('✅ Lambda API からTodo取得成功:', safeTodos.length, '件');
      return NextResponse.json(safeTodos);
    } else {
      console.log('⚠️ Lambda API からのデータが空またはエラー');
      return NextResponse.json([], { status: 200 });
    }

  } catch (error) {
    console.error('❌ Lambda API接続エラー:', error);
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

    console.log('🔄 Lambda API経由でTodo作成を試行');
    
    // Lambda API用のリクエストデータを準備
    const todoData = {
      title: body.title,
      description: body.description || undefined,
      userId: session.user.id,
      priority: body.priority || 'MEDIUM',
      dueDate: body.dueDate || undefined
    };
    
    console.log('📤 Lambda API送信データ:', todoData);
    
    // Lambda API経由でTodoを作成
    const lambdaResponse = await lambdaAPI.post('/todos', todoData);
    console.log('📥 Lambda API作成レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // レスポンスデータの安全な日付変換とPrisma型との互換性確保
      const newTodo = {
        ...lambdaResponse.data,
        createdAt: safeToISOString(lambdaResponse.data.createdAt),
        updatedAt: safeToISOString(lambdaResponse.data.updatedAt),
        dueDate: lambdaResponse.data.dueDate ? safeToISOString(lambdaResponse.data.dueDate) : null,
        priority: lambdaResponse.data.priority || 'MEDIUM',
        category: lambdaResponse.data.category || null,
        tags: lambdaResponse.data.tags || []
      };
      
      console.log('✅ Lambda API でのTodo作成成功:', newTodo.id);
      return NextResponse.json(newTodo, { status: 201 });
    } else {
      console.error('❌ Lambda API作成失敗:', lambdaResponse.error);
      return NextResponse.json({ error: lambdaResponse.error || 'Todo作成に失敗しました' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Lambda API接続エラー:', error);
    return NextResponse.json({ error: 'Todo作成に失敗しました' }, { status: 500 });
  }
}

