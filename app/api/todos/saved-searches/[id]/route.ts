import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

// DELETE: 保存済み検索の削除
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
    const existingSavedSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingSavedSearch) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 })
    }

    await prisma.savedSearch.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Saved search deleted successfully' })
  } catch (error) {
    console.error('Error deleting saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT: 保存済み検索の更新
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
    const { name, filters } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Search name is required' }, { status: 400 })
    }

    // 所有者確認
    const existingSavedSearch = await prisma.savedSearch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!existingSavedSearch) {
      return NextResponse.json({ error: 'Saved search not found' }, { status: 404 })
    }

    const updatedSavedSearch = await prisma.savedSearch.update({
      where: { id },
      data: {
        name: name.trim(),
        filters: JSON.stringify(filters),
      }
    })

    return NextResponse.json(updatedSavedSearch)
  } catch (error) {
    console.error('Error updating saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}