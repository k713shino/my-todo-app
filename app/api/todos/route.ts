import { NextRequest, NextResponse } from 'next/server';
import { Priority } from '@prisma/client';
import { getAuthSession, isAuthenticated } from '@/lib/session-utils';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'

// 全てのTodoを取得
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json([], { status: 200 });
    }

    // Lambda APIの実装に問題があるため、ローカルPrismaデータベースを使用
    console.log('⚠️ Lambda API実装問題のため、ローカルデータベースを使用');
    
    // PrismaでTodoを取得
    const prismaeTodos = await prisma.todo.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('✅ ローカルデータベースからTodo取得成功:', prismaeTodos.length, '件');
    return NextResponse.json(prismaeTodos);

  } catch (error) {
    console.error('❌ データベースエラー:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// 新しいTodoを作成
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await request.json();
    
    // バリデーション
    if (!body.title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Lambda APIの実装問題のため、ローカルPrismaデータベースに直接保存
    console.log('⚠️ Lambda API実装問題のため、ローカルデータベースに保存');
    
    const newTodo = await prisma.todo.create({
      data: {
        title: body.title,
        description: body.description || null,
        completed: false,
        priority: (body.priority || Priority.MEDIUM) as Priority,
        category: body.category || null,
        tags: body.tags || [],
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        userId: session.user.id,
      }
    });

    console.log('✅ ローカルデータベースでのTodo作成成功:', newTodo.id);
    return NextResponse.json(newTodo, { status: 201 });

  } catch (error) {
    console.error('❌ Todo作成エラー:', error);
    return NextResponse.json({ error: 'Todo作成に失敗しました' }, { status: 500 });
  }
}

