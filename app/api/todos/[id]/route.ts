import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { PubSubManager } from '@/lib/pubsub'

/**
 * PUT: Todo更新API
 *
 * 機能:
 * - 認証済みユーザーのTodoを更新
 * - 所有者確認による不正更新防止
 * - 部分更新対応（指定フィールドのみ更新）
 * - 完了状態変更時の特別なアクティビティ記録
 *
 * データ整合性:
 * - キャッシュの自動無効化
 * - PubSubによるリアルタイム通知
 * - 更新前後の状態比較による適切なイベント発行
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, completed, priority, dueDate, category, tags } = body

    // 所有者確認
    const existingTodo = await prisma.todo.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    // Todo更新
    const todo = await prisma.todo.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(completed !== undefined && { completed }),
        ...(priority !== undefined && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(tags !== undefined && { 
          tags: Array.isArray(tags)
            ? tags.map((tag) => tag.trim()).filter(Boolean)
            : []
        }),
      },
    })

    // 同期的にキャッシュ無効化（即座に反映）
    await CacheManager.invalidateUserTodos(session.user.id)
    console.log('🗑️ Cache invalidated after todo update')

    // 非同期でイベント発行（レスポンスをブロックしない）
    const eventPromises = [
      PubSubManager.publishTodoEvent({
        type: 'updated',
        todo,
        userId: session.user.id,
        timestamp: Date.now()
      })
    ]

    // 完了状態変更の場合は特別なアクティビティ記録
    if (completed !== undefined && completed !== existingTodo.completed) {
      eventPromises.push(
        PubSubManager.publishUserActivity({
          userId: session.user.id,
          action: completed ? 'todo_completed' : 'todo_uncompleted',
          timestamp: Date.now(),
          metadata: { todoId: todo.id, title: todo.title }
        })
      )
    }

    Promise.allSettled(eventPromises).catch(error => {
      console.error('Background event publishing error (non-blocking):', error)
    })

    return NextResponse.json(todo, {
      headers: {
        'X-Cache-Invalidated': 'true',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Todo更新エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

/**
 * DELETE: Todo削除API
 *
 * 機能:
 * - 認証済みユーザーのTodoを削除
 * - 所有者確認による不正削除防止
 * - 削除前のTodo情報保持（ログ・通知用）
 *
 * データ整合性:
 * - キャッシュの自動無効化
 * - PubSubによる削除イベントの発行
 * - ユーザーアクティビティへの記録
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // 所有者確認
    const existingTodo = await prisma.todo.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 })
    }

    // Todo削除
    await prisma.todo.delete({
      where: { id },
    })

    // 同期的にキャッシュ無効化（即座に反映）
    await CacheManager.invalidateUserTodos(session.user.id)
    console.log('🗑️ Cache invalidated after todo deletion')

    // 非同期でイベント発行（レスポンスをブロックしない）
    Promise.allSettled([
      PubSubManager.publishTodoEvent({
        type: 'deleted',
        todo: { id, userId: session.user.id },
        userId: session.user.id,
        timestamp: Date.now()
      }),
      PubSubManager.publishUserActivity({
        userId: session.user.id,
        action: 'todo_deleted',
        timestamp: Date.now(),
        metadata: { todoId: id, title: existingTodo.title }
      })
    ]).catch(error => {
      console.error('Background event publishing error (non-blocking):', error)
    })

    return NextResponse.json({ message: 'Todo deleted successfully' }, {
      headers: {
        'X-Cache-Invalidated': 'true',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Todo削除エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}