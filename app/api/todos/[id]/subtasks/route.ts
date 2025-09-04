import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lambdaAPI } from '@/lib/lambda-api'
import { CreateTodoData } from '@/types/todo'
import { CacheManager } from '@/lib/cache'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

/**
 * サブタスク取得API
 * GET /api/todos/[id]/subtasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: parentId } = await params
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    console.log('🔍 サブタスク取得開始:', { parentId, userId: session.user.id, actualUserId })

    // 親タスクが存在し、ユーザーがオーナーかチェック
    const parentTodos = await lambdaAPI.getUserTodos(actualUserId)
    if (!parentTodos || !Array.isArray(parentTodos)) {
      throw new Error('Failed to fetch parent todos')
    }

    const parentTodo = parentTodos.find(todo => todo.id.toString() === parentId)
    if (!parentTodo) {
      return NextResponse.json({ error: 'Parent todo not found' }, { status: 404 })
    }

    // 全てのTodoを取得してサブタスクをフィルタリング
    const allTodos = parentTodos
    let subtasks = allTodos.filter(todo => 
      todo.parentId && todo.parentId.toString() === parentId
    )

    // 並び順をRedisから取得して適用
    try {
      const order = await CacheManager.getSubtaskOrder(actualUserId, parentId)
      if (order && Array.isArray(order) && order.length > 0) {
        const map = new Map(subtasks.map(t => [t.id.toString(), t]))
        const ordered: typeof subtasks = []
        for (const id of order) {
          const item = map.get(id)
          if (item) {
            ordered.push(item)
            map.delete(id)
          }
        }
        // 順序にない新規は作成日時で末尾に
        const rest = Array.from(map.values()).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        subtasks = [...ordered, ...rest]
      }
    } catch (e) {
      console.log('⚠️ サブタスク順序適用失敗:', e)
    }

    console.log('✅ サブタスク取得成功:', { parentId, count: subtasks.length })

    return NextResponse.json(subtasks.map(todo => ({
      id: todo.id.toString(),
      title: todo.title,
      description: todo.description,
      status: todo.status || (todo.completed ? 'DONE' : 'TODO'),
      priority: todo.priority || 'MEDIUM',
      category: todo.category,
      tags: Array.isArray(todo.tags) ? todo.tags : 
            (todo.tags ? todo.tags.split(',').filter(Boolean) : []),
      dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
      createdAt: new Date(todo.createdAt),
      updatedAt: new Date(todo.updatedAt),
      userId: todo.userId,
      parentId: todo.parentId?.toString(),
    })))

  } catch (error) {
    console.error('❌ サブタスク取得エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * サブタスク作成API
 * POST /api/todos/[id]/subtasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: parentId } = await params
    const body = await request.json() as CreateTodoData
    const actualUserId = extractUserIdFromPrefixed(session.user.id)

    console.log('📝 サブタスク作成開始:', { parentId, userId: session.user.id, actualUserId, body })

    // 親タスクの存在確認
    const parentTodos = await lambdaAPI.getUserTodos(actualUserId)
    if (!parentTodos || !Array.isArray(parentTodos)) {
      throw new Error('Failed to fetch parent todos')
    }

    const parentTodo = parentTodos.find(todo => todo.id.toString() === parentId)
    if (!parentTodo) {
      return NextResponse.json({ error: 'Parent todo not found' }, { status: 404 })
    }

    // サブタスクのデータを準備
    const subtaskData: CreateTodoData & { parentId: string } = {
      title: body.title,
      description: body.description,
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
      dueDate: body.dueDate,
      category: body.category,
      tags: body.tags,
      externalId: (body as any).externalId,
      externalSource: (body as any).externalSource,
      parentId: parentId
    }

    // Lambda APIを使用してサブタスクを作成
    // 外部ID重複の事前チェック（同一親配下での重複も避けたい）
    try {
      if (subtaskData.externalId) {
        const existing = await lambdaAPI.getUserTodos(actualUserId)
        const conflict = Array.isArray(existing) && existing.find((t: any) => {
          const sameId = (t.externalId || null) === subtaskData.externalId
          const sameSource = (subtaskData.externalSource ? (t.externalSource || null) === subtaskData.externalSource : true)
          // サブタスクは parentId も一致している場合に重複とみなす
          const sameParent = (t.parentId ? t.parentId.toString() : null) === parentId
          return sameId && sameSource && sameParent
        })
        if (conflict) {
          return NextResponse.json({ error: 'Duplicate subtask by externalId', conflictId: conflict.id }, { status: 409 })
        }
      }
    } catch (e) {
      console.log('⚠️ サブタスク重複チェック失敗（継続）:', e)
    }

    const newTodo = await lambdaAPI.createTodo({
      ...subtaskData,
      // Lambda API 型では dueDate は文字列/ISO を期待するため変換
      dueDate: subtaskData.dueDate ? new Date(subtaskData.dueDate).toISOString() : undefined,
      userId: actualUserId,
      userEmail: session.user.email || '',
      userName: session.user.name || '',
    })
    console.log('✅ サブタスク作成成功:', { subtaskId: newTodo.id, parentId })

    // 親ユーザーのTodoキャッシュを無効化（ロールアップ再計算のため）
    try {
      await CacheManager.invalidateUserTodos(session.user.id)
      console.log('📦 親Todoキャッシュ無効化完了')
    } catch (cacheError) {
      console.log('⚠️ 親Todoキャッシュ無効化失敗:', cacheError)
    }

    // 既存の順序があれば先頭に追加
    try {
      const prev = await CacheManager.getSubtaskOrder(actualUserId, parentId)
      const nextOrder = [newTodo.id.toString(), ...(prev || [])]
      await CacheManager.setSubtaskOrder(actualUserId, parentId, nextOrder)
    } catch {}

    return NextResponse.json({
      id: newTodo.id.toString(),
      title: newTodo.title,
      description: newTodo.description,
      status: newTodo.status || (newTodo.completed ? 'DONE' : 'TODO'),
      priority: newTodo.priority || 'MEDIUM',
      category: newTodo.category,
      tags: Array.isArray(newTodo.tags) ? newTodo.tags : 
            (newTodo.tags ? newTodo.tags.split(',').filter(Boolean) : []),
      dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
      createdAt: new Date(newTodo.createdAt),
      updatedAt: new Date(newTodo.updatedAt),
      userId: newTodo.userId,
      parentId: newTodo.parentId?.toString(),
    }, { status: 201 })

  } catch (error) {
    console.error('❌ サブタスク作成エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * サブタスク並び順更新
 * PATCH /api/todos/[id]/subtasks
 * Body: { order: string[] }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id: parentId } = await params
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    const body = await request.json() as { order?: string[] }
    if (!Array.isArray(body.order)) {
      return NextResponse.json({ error: 'Invalid order payload' }, { status: 400 })
    }
    // 現在のサブタスクを取得して妥当性チェック
    const parentTodos = await lambdaAPI.getUserTodos(actualUserId)
    const allTodos = parentTodos || []
    const validIds = new Set(
      allTodos
        .filter((t: any) => t.parentId && t.parentId.toString() === parentId)
        .map((t: any) => t.id.toString())
    )
    const cleaned = body.order.filter(id => validIds.has(id))
    await CacheManager.setSubtaskOrder(actualUserId, parentId, cleaned)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ サブタスク順序更新エラー:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
