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

    console.log('🔄 Lambda API経由で全Todo取得を試行（一時的対応）');
    console.log('🔍 現在のユーザーID:', session.user.id);
    
    // Lambda API経由で全Todoを取得
    const lambdaResponse = await lambdaAPI.get('/todos');
    console.log('📥 Lambda API レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // レスポンスデータの安全な日付変換
      const allTodos = Array.isArray(lambdaResponse.data) ? lambdaResponse.data : [];
      console.log('📊 全Todo件数:', allTodos.length);
      
      // フロントエンド側でユーザー固有のフィルタリング（Google認証IDベース）
      const userTodos = allTodos.filter((todo: any) => {
        // 複数のマッピングパターンに対応
        const todoUserId = todo.userId;
        const currentGoogleId = session.user.id;
        
        // 直接比較
        if (todoUserId === currentGoogleId) return true;
        
        // 既知のマッピング
        if (currentGoogleId === '110701307742242924558' && todoUserId === 'cmdpi4dye0000lc04xn7yujpn') return true;
        if (currentGoogleId === '112433279481859708110' && todoUserId === 'cmdsbbogh0000l604u08lqcp4') return true;
        
        return false;
      });
      
      console.log('👤 ユーザー固有Todo件数:', userTodos.length);
      console.log('🔍 フィルタリング結果:', userTodos.map((t: any) => ({ id: t.id, title: t.title, userId: t.userId })));
      
      const safeTodos = userTodos.map((todo: any) => ({
        ...todo,
        createdAt: safeToISOString(todo.createdAt),
        updatedAt: safeToISOString(todo.updatedAt),
        dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
        // Prisma型との互換性のため必要なフィールドを追加
        priority: todo.priority || 'MEDIUM',
        userId: todo.userId,
        category: todo.category || null,
        tags: todo.tags || []
      }));
      
      console.log('✅ ユーザー固有Todo取得成功:', safeTodos.length, '件');
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
      dueDate: body.dueDate || undefined,
      category: body.category || undefined,
      tags: body.tags || undefined
    };
    
    console.log('📤 Lambda API送信データ:', todoData);
    
    // Lambda API経由でTodoを作成
    const lambdaResponse = await lambdaAPI.post('/todos', todoData);
    console.log('📥 Lambda API作成レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // 古いLambda関数の形式（message + todo）と新しい形式（直接Todo）の両方に対応
      let todoData = lambdaResponse.data;
      
      // 古い形式の場合（message + todo形式）
      if (lambdaResponse.data.message && lambdaResponse.data.todo) {
        console.log('📋 古いLambda形式を検出:', lambdaResponse.data);
        todoData = lambdaResponse.data.todo;
        
        // 不足フィールドを補完（古い形式用）
        todoData = {
          id: todoData.id || `temp-${Date.now()}`, // IDがない場合は一時ID
          title: todoData.title,
          description: todoData.description || null,
          completed: todoData.completed || false,
          priority: todoData.priority || 'MEDIUM',
          dueDate: todoData.dueDate || null,
          createdAt: new Date().toISOString(), // 現在時刻で補完
          updatedAt: new Date().toISOString(), // 現在時刻で補完
          userId: todoData.userId,
          category: todoData.category || null,
          tags: todoData.tags || []
        };
      }
      
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

