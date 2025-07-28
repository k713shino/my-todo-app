import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager, RateLimiter } from '@/lib/cache'
import { PubSubManager } from '@/lib/pubsub'
import { Priority } from '@prisma/client'

/**
 * GET: Todo一覧の取得API
 *
 * 機能:
 * - 認証済みユーザーのTodo一覧を取得
 * - キャッシュによる高速なレスポンス
 * - レート制限による不正アクセス防止
 * - 完了状態・優先度によるフィルタリング
 *
 * キャッシュ戦略:
 * - フィルターがない場合のみキャッシュを使用
 * - キャッシュミス時はDBから取得して保存
 * - cache=falseクエリでキャッシュ無効化可能
 */
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

    // ユーザーアクティビティ更新（非同期）
    CacheManager.updateUserActivity(session.user.id).catch(error => {
      console.error('User activity update error (non-blocking):', error)
    })

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

/**
 * POST: 新規Todo作成API
 *
 * 機能:
 * - 認証済みユーザーのTodoを作成
 * - 厳格なレート制限（1時間に100件まで）
 * - タイトルのバリデーション
 * - リアルタイム更新のイベント発行
 *
 * データ整合性:
 * - キャッシュの自動無効化
 * - PubSubによるリアルタイム通知
 * - ユーザーアクティビティの記録
 */
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

    // 非同期でキャッシュ無効化とイベント発行（レスポンスをブロックしない）
    Promise.allSettled([
      CacheManager.invalidateUserTodos(session.user.id).then(() => {
        console.log('🗑️ Cache invalidated after todo creation')
      }),
      PubSubManager.publishTodoEvent({
        type: 'created',
        todo,
        userId: session.user.id,
        timestamp: Date.now()
      }),
      PubSubManager.publishUserActivity({
        userId: session.user.id,
        action: 'todo_created',
        timestamp: Date.now(),
        metadata: { todoId: todo.id, title: todo.title }
      })
    ]).catch(error => {
      console.error('Background task error (non-blocking):', error)
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