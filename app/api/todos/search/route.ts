import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { Todo, TodoFilters } from '@/types/todo'
import { safeToISOString } from '@/lib/date-utils'
import { Priority } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 フロントエンドAPI GET /api/todos/search 呼び出し開始');
    
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters: TodoFilters = {
      search: searchParams.get('q') || undefined,
      completed: searchParams.get('completed') ? searchParams.get('completed') === 'true' : undefined,
      priority: searchParams.get('priority') as Priority || undefined,
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      dateRange: searchParams.get('dateRange') as any || undefined,
    }

    console.log('🔍 検索フィルター:', filters);
    console.log('👤 現在のユーザー:', session.user.id);

    // Lambda API経由で全Todoを取得してフロントエンドでフィルタリング
    console.log('📡 Lambda API経由で全Todo取得開始...');
    const lambdaResponse = await lambdaAPI.get('/todos');
    
    if (!lambdaResponse.success || !lambdaResponse.data) {
      console.error('❌ Lambda API失敗:', lambdaResponse.error);
      return NextResponse.json({ 
        filters,
        results: [],
        count: 0,
        error: 'Failed to fetch todos from Lambda API'
      }, { status: 500 });
    }

    const allTodos = Array.isArray(lambdaResponse.data) ? lambdaResponse.data : [];
    console.log('📊 全Todo件数:', allTodos.length);

    // ユーザー固有Todoのフィルタリング（既存のスマートマッピング使用）
    let userTodos = allTodos.filter((todo: any) => {
      const todoUserId = todo.userId;
      const currentGoogleId = session.user.id;
      
      // 直接比較
      if (todoUserId === currentGoogleId) return true;
      
      // 既知のマッピング
      if (currentGoogleId === '110701307742242924558' && todoUserId === 'cmdpi4dye0000lc04xn7yujpn') return true;
      if (currentGoogleId === '112433279481859708110' && todoUserId === 'cmdsbbogh0000l604u08lqcp4') return true;
      
      return false;
    });

    // スマートマッピング：新規ユーザーの場合
    if (userTodos.length === 0) {
      console.log('🔍 スマートマッピング: 新規ユーザーの可能性をチェック');
      
      const newUserTodos = allTodos.filter((todo: any) => {
        const userId = todo.userId;
        if (!userId || !userId.startsWith('c') || userId.length < 15) return false;
        
        const todoCreatedAt = new Date(todo.createdAt);
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        return todoCreatedAt > thirtyMinutesAgo;
      });
      
      if (newUserTodos.length > 0) {
        const sortedTodos = newUserTodos.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const detectedUserId = sortedTodos[0].userId;
        
        console.log('🆕 新規ユーザー検出:', detectedUserId);
        userTodos = allTodos.filter((todo: any) => todo.userId === detectedUserId);
      }
    }

    console.log('📊 ユーザー固有Todo件数:', userTodos.length);

    // 検索フィルタリング適用
    let filteredTodos = userTodos;

    // 全文検索
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredTodos = filteredTodos.filter((todo: any) => {
        return (
          todo.title?.toLowerCase().includes(searchTerm) ||
          todo.description?.toLowerCase().includes(searchTerm) ||
          todo.category?.toLowerCase().includes(searchTerm)
        );
      });
      console.log(`🔍 全文検索 "${filters.search}" 結果:`, filteredTodos.length, '件');
    }

    // 完了状態フィルター
    if (filters.completed !== undefined) {
      filteredTodos = filteredTodos.filter((todo: any) => todo.completed === filters.completed);
      console.log(`✅ 完了状態フィルター "${filters.completed}" 結果:`, filteredTodos.length, '件');
    }

    // 優先度フィルター
    if (filters.priority) {
      filteredTodos = filteredTodos.filter((todo: any) => todo.priority === filters.priority);
      console.log(`⚡ 優先度フィルター "${filters.priority}" 結果:`, filteredTodos.length, '件');
    }

    // カテゴリフィルター
    if (filters.category) {
      const categoryTerm = filters.category.toLowerCase();
      filteredTodos = filteredTodos.filter((todo: any) => 
        todo.category?.toLowerCase().includes(categoryTerm)
      );
      console.log(`📁 カテゴリフィルター "${filters.category}" 結果:`, filteredTodos.length, '件');
    }

    // タグフィルター
    if (filters.tags && filters.tags.length > 0) {
      filteredTodos = filteredTodos.filter((todo: any) => {
        const todoTags = Array.isArray(todo.tags) ? todo.tags : [];
        return filters.tags!.some(tag => todoTags.includes(tag));
      });
      console.log(`🏷️ タグフィルター "${filters.tags.join(',')}" 結果:`, filteredTodos.length, '件');
    }

    // 日付範囲フィルター
    if (filters.dateRange) {
      const now = new Date();
      
      if (filters.dateRange === 'overdue') {
        filteredTodos = filteredTodos.filter((todo: any) => {
          return todo.dueDate && new Date(todo.dueDate) < now && !todo.completed;
        });
      } else if (filters.dateRange === 'today') {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        filteredTodos = filteredTodos.filter((todo: any) => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= todayStart && dueDate < todayEnd;
        });
      } else if (filters.dateRange === 'this_week') {
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        filteredTodos = filteredTodos.filter((todo: any) => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate <= weekEnd;
        });
      } else if (filters.dateRange === 'no_due_date') {
        filteredTodos = filteredTodos.filter((todo: any) => !todo.dueDate);
      }
      
      console.log(`📅 日付範囲フィルター "${filters.dateRange}" 結果:`, filteredTodos.length, '件');
    }

    // ソート（優先度、期限、更新日時順）
    filteredTodos.sort((a: any, b: any) => {
      // 完了状態（未完了を先に）
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // 優先度（高いものを先に）
      const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 2;
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 2;
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // 期限（近いものを先に）
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      
      // 更新日時（新しいものを先に）
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 安全な日付変換
    const results = filteredTodos.map((todo: any) => ({
      ...todo,
      createdAt: safeToISOString(todo.createdAt),
      updatedAt: safeToISOString(todo.updatedAt),
      dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
      priority: todo.priority || 'MEDIUM',
      category: todo.category || null,
      tags: todo.tags || []
    }));

    console.log('✅ 検索完了:', {
      totalTodos: allTodos.length,
      userTodos: userTodos.length,
      filteredResults: results.length,
      filters
    });

    return NextResponse.json({
      filters,
      results,
      count: results.length,
      cached: false // Lambda経由なのでキャッシュなし
    })

  } catch (error) {
    console.error('❌ 検索処理で例外発生:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}