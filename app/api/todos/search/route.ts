import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { Todo } from '@/types/todo'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const useCache = searchParams.get('cache') !== 'false'

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    // 型を明示的に指定します
    const cacheKey = `search:${session.user.id}:${Buffer.from(query).toString('base64')}`
    let searchResults: Todo[] | null = null
    
    if (useCache) {
      searchResults = await CacheManager.get<Todo[]>(cacheKey)
    }

    if (!searchResults) {
      // データベースで検索実行
      const dbResults = await prisma.todo.findMany({
        where: {
          userId: session.user.id,
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive'
              }
            },
            {
              description: {
                contains: query,
                mode: 'insensitive'
              }
            }
          ]
        },
        orderBy: [
          { completed: 'asc' },
          { priority: 'desc' },
          { updatedAt: 'desc' }
        ]
      })

      // Prismaの結果をTodo型に変換します
      searchResults = dbResults.map(todo => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt),
        dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
      }))

      // 結果をキャッシュ（10分間）
      if (useCache) {
        await CacheManager.set(cacheKey, searchResults, 600)
      }
    }

    // null チェックで安全に処理します
    const results = searchResults || []

    return NextResponse.json({
      query,
      results,
      count: results.length,
      cached: searchResults !== null
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}