import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PUT: Todo更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
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

    return NextResponse.json(todo)
  } catch (error) {
    console.error('Todo更新エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE: Todo削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
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

    await prisma.todo.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Todo deleted successfully' })
  } catch (error) {
    console.error('Todo削除エラー:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}