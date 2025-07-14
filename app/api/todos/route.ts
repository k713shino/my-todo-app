import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager, RateLimiter } from '@/lib/cache'
import { PubSubManager } from '@/lib/pubsub'
import { Priority } from '@prisma/client'

// GET: Todo一覧取得（キャッシュ対応）
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限チェック（1時間に1000回まで）
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `todos:${session.user.id}`, 
      3600, 
      1000
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      )
    }

    const { searchParams } = new URL(request.url)
    const completed = searchParams.get('completed')
    const priority = searchParams.get('priority') as Priority | null
    const useCache = searchParams.get('cache') !== 'false'

    // キャッシュから取得を試行（フィルターがない場合のみ）
    let todos = null
    if (useCache && !completed && !priority) {
      todos = await CacheManager.getTodos(session.user.id)
      console.log('📦 Cache hit:', !!todos)
    }

    // キャッシュミスまたはフィルター条件がある場合はDBから取得
    if (!todos) {
      console.log('🔍 Fetching from database...')
      todos = await prisma.todo.findMany({
        where: {
          userId: session.user.id,
          ...(completed !== null && { completed: completed === 'true' }),
          ...(priority && { priority }),
        },
        orderBy: [
          { completed: 'asc' },
          { priority: 'desc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
      })

      // フィルター条件がない場合はキャッシュに保存
      if (useCache && !completed && !priority) {
        await CacheManager.setTodos(session.user.id, todos)
        console.log('💾 Data cached')
      }
    }

    // ユーザーアクティビティ更新
    await CacheManager.updateUserActivity(session.user.id)

    return NextResponse.json(todos, {
      headers: {
        'X-Cache': todos ? 'HIT' : 'MISS',
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString()
      }
    })
  } catch (error) {
    console.error('Todo取得エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST: Todo作成（PubSub・キャッシュ無効化対応）
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限チェック（作成は厳しめ）
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `create_todos:${session.user.id}`, 
      3600, 
      100
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Creation rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { title, description, priority, dueDate } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
    }

    // Todo作成
    const todo = await prisma.todo.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        userId: session.user.id,
      },
    })

    // キャッシュ無効化（新しいTodoが追加されたので古いキャッシュを削除）
    await CacheManager.invalidateUserTodos(session.user.id)
    console.log('🗑️ Cache invalidated after todo creation')

    // リアルタイムイベント発行
    await PubSubManager.publishTodoEvent({
      type: 'created',
      todo,
      userId: session.user.id,
      timestamp: Date.now()
    })

    // ユーザーアクティビティ発行
    await PubSubManager.publishUserActivity({
      userId: session.user.id,
      action: 'todo_created',
      timestamp: Date.now(),
      metadata: { todoId: todo.id, title: todo.title }
    })

    return NextResponse.json(todo, { 
      status: 201,
      headers: {
        'X-Cache-Invalidated': 'true'
      }
    })
  } catch (error) {
    console.error('Todo作成エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}