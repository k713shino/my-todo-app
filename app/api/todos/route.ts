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

    console.log('🔍 改善されたユーザー固有Todo取得開始');
    console.log('👤 現在のGoogleユーザーID:', session.user.id);
    
    // 改善されたLambda API: ユーザー固有エンドポイントを使用
    const userSpecificEndpoint = `/todos/user/${session.user.id}`;
    console.log('🌐 Lambda API エンドポイント:', userSpecificEndpoint);
    
    const lambdaResponse = await lambdaAPI.get(userSpecificEndpoint);
    console.log('📡 Lambda API レスポンス:', {
      success: lambdaResponse.success,
      dataLength: lambdaResponse.data ? lambdaResponse.data.length : 0
    });
    
    if (lambdaResponse.success && lambdaResponse.data) {
      const userTodos = Array.isArray(lambdaResponse.data) ? lambdaResponse.data : [];
      console.log('📊 ユーザー固有Todo件数:', userTodos.length);
      
      // Lambdaから返されたデータを安全に処理
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
      // Lambda側でエラーが発生した場合の詳細ログ
      console.log('⚠️ Lambda API エラー:', lambdaResponse.error || 'データなし');
      
      // エラーの場合も空配列を返して UI の破綻を防ぐ
      return NextResponse.json([], { status: 200 });
    }

  } catch (error) {
    console.error('❌ ユーザー固有Todo取得エラー:', error);
    
    // ネットワークエラーやその他の例外でも空配列を返す
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

    console.log('🔄 改善されたLambda API経由でTodo作成');
    console.log('👤 現在のユーザー:', {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name
    });
    
    // 改善されたLambda API用のリクエストデータ（userEmailも含む）
    const todoData = {
      title: body.title,
      description: body.description || undefined,
      userId: session.user.id,
      userEmail: session.user.email || undefined, // 新規ユーザー作成用
      userName: session.user.name || undefined,   // 将来的な拡張用
      priority: body.priority || 'MEDIUM',
      dueDate: body.dueDate || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined
    };
    
    console.log('📤 Lambda API送信データ:', todoData);
    
    // Lambda API経由でTodoを作成
    const lambdaResponse = await lambdaAPI.post('/todos', todoData);
    console.log('📡 Lambda API作成レスポンス:', {
      success: lambdaResponse.success,
      hasData: !!lambdaResponse.data,
      error: lambdaResponse.error
    });
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // Lambdaからの新しい形式のレスポンスを処理
      const todoData = lambdaResponse.data;
      
      // レスポンスデータの安全な日付変換とPrisma型との互換性確保
      const newTodo = {
        ...todoData,
        createdAt: safeToISOString(todoData.createdAt),
        updatedAt: safeToISOString(todoData.updatedAt),
        dueDate: todoData.dueDate ? safeToISOString(todoData.dueDate) : null,
        priority: todoData.priority || 'MEDIUM',
        category: todoData.category || null,
        tags: todoData.tags || []
      };
      
      console.log('✅ 改善されたLambda APIでのTodo作成成功:', newTodo.id);
      return NextResponse.json(newTodo, { status: 201 });
      
    } else {
      console.error('❌ Lambda APIでのTodo作成失敗:', lambdaResponse.error);
      return NextResponse.json({ 
        error: lambdaResponse.error || 'Todo作成に失敗しました' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Todo作成処理エラー:', error);
    return NextResponse.json({ 
      error: 'Todo作成に失敗しました' 
    }, { status: 500 });
  }
}

