import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'
import { PubSubManager } from '@/lib/pubsub'

// PUT: Todo更新（PubSub・キャッシュ対応）
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
    const { title, description, completed, priority, dueDate } = body

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
      },
    })

    // キャッシュ無効化
    await CacheManager.invalidateUserTodos(session.user.id)

    // リアルタイムイベント発行
    await PubSubManager.publishTodoEvent({
      type: 'updated',
      todo,
      userId: session.user.id,
      timestamp: Date.now()
    })

    // 完了状態変更の場合は特別なアクティビティ記録
    if (completed !== undefined && completed !== existingTodo.completed) {
      await PubSubManager.publishUserActivity({
        userId: session.user.id,
        action: completed ? 'todo_completed' : 'todo_uncompleted',
        timestamp: Date.now(),
        metadata: { todoId: todo.id, title: todo.title }
      })
    }

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Todo更新エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: Todo削除（PubSub・キャッシュ対応）
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

    // キャッシュ無効化
    await CacheManager.invalidateUserTodos(session.user.id)

    // リアルタイムイベント発行
    await PubSubManager.publishTodoEvent({
      type: 'deleted',
      todo: { id, userId: session.user.id },
      userId: session.user.id,
      timestamp: Date.now()
    })

    // アクティビティ記録
    await PubSubManager.publishUserActivity({
      userId: session.user.id,
      action: 'todo_deleted',
      timestamp: Date.now(),
      metadata: { todoId: id, title: existingTodo.title }
    })

    return NextResponse.json({ message: 'Todo deleted successfully' })
  } catch (error) {
    console.error('Todo削除エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}