import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { lambdaAPI } from '@/lib/lambda-api'
import { CreateTodoData } from '@/types/todo'
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
    const subtasks = allTodos.filter(todo => 
      todo.parentId && todo.parentId.toString() === parentId
    )

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
      parentId: parentId
    }

    // Lambda APIを使用してサブタスクを作成
    const newTodo = await lambdaAPI.createTodo({
      ...subtaskData,
      userId: actualUserId,
      userEmail: session.user.email || '',
      userName: session.user.name || '',
    })
    console.log('✅ サブタスク作成成功:', { subtaskId: newTodo.id, parentId })

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