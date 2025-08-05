import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { Todo, TodoFilters } from '@/types/todo'
import { getDateRangeFromPreset } from '@/lib/date-utils'
import { Priority } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
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

    const useCache = searchParams.get('cache') !== 'false'
    const saveToHistory = searchParams.get('saveHistory') !== 'false'

    // キャッシュキー生成
    const cacheKey = `search:${session.user.id}:${Buffer.from(JSON.stringify(filters)).toString('base64')}`
    let searchResults: Todo[] | null = null
    
    if (useCache) {
      searchResults = await CacheManager.get<Todo[]>(cacheKey)
    }

    if (!searchResults) {
      // 検索条件を構築
      const where: any = {
        userId: session.user.id,
      }

      // 全文検索
      if (filters.search) {
        where.OR = [
          {
            title: {
              contains: filters.search,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: filters.search,
              mode: 'insensitive'
            }
          },
          {
            category: {
              contains: filters.search,
              mode: 'insensitive'
            }
          }
        ]
      }

      // 完了状態フィルター
      if (filters.completed !== undefined) {
        where.completed = filters.completed
      }

      // 優先度フィルター
      if (filters.priority) {
        where.priority = filters.priority
      }

      // カテゴリフィルター
      if (filters.category) {
        where.category = {
          contains: filters.category,
          mode: 'insensitive'
        }
      }

      // タグフィルター
      if (filters.tags && filters.tags.length > 0) {
        where.tags = {
          hasSome: filters.tags
        }
      }

      // 日付範囲フィルター
      if (filters.dateRange) {
        const dateRange = getDateRangeFromPreset(filters.dateRange)
        
        if (dateRange.isOverdue) {
          where.dueDate = {
            lt: new Date(),
            not: null
          }
          where.completed = false
        } else if (dateRange.isNoDueDate) {
          where.dueDate = null
        } else if (dateRange.start || dateRange.end) {
          where.dueDate = {
            ...(dateRange.start && { gte: dateRange.start }),
            ...(dateRange.end && { lte: dateRange.end }),
            not: null
          }
        }
      }

      // データベースで検索実行
      const dbResults = await prisma.todo.findMany({
        where,
        orderBy: [
          { completed: 'asc' },
          { priority: 'desc' },
          { dueDate: 'asc' },
          { updatedAt: 'desc' }
        ]
      })

      // Prismaの結果をTodo型に変換
      searchResults = dbResults.map(todo => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt),
        dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
        category: todo.category ?? undefined,
      }))

      // 結果をキャッシュ（10分間）
      if (useCache) {
        await CacheManager.set(cacheKey, searchResults, 600)
      }
    }

    // 検索履歴に保存（バックグラウンドで実行）
    if (saveToHistory && (filters.search || Object.keys(filters).filter(key => filters[key as keyof TodoFilters] !== undefined).length > 0)) {
      Promise.resolve().then(async () => {
        try {
          // SearchHistoryテーブルが存在しない場合はスキップ
          const tableExists = await prisma.$queryRaw`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'search_history'
            );
          `
          
          if ((tableExists as any[])[0]?.exists) {
            await prisma.searchHistory.create({
              data: {
                query: filters.search || '',
                filters: JSON.stringify(filters),
                userId: session.user.id,
              }
            })
          }
        } catch (error) {
          console.error('Failed to save search history:', error)
        }
      })
    }

    const results = searchResults || []

    return NextResponse.json({
      filters,
      results,
      count: results.length,
      cached: searchResults !== null
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}