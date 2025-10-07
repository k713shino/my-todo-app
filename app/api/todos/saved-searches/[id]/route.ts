import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'

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

    try {
      // ユーザーIDをパラメータとして渡すために、直接requestメソッドを使用
      const _result = await lambdaAPI.request(`/saved-searches/${id}?userId=${encodeURIComponent((session as any).user.id)}`, {
        method: 'DELETE',
      })
      return NextResponse.json({ message: 'Saved search deleted successfully' })
    } catch (deleteError) {
      console.error('Delete error:', deleteError)
      const status = deleteError instanceof Error && deleteError.message.includes('not found') ? 404 : 500
      return NextResponse.json({ 
        error: deleteError instanceof Error ? deleteError.message : 'Failed to delete saved search' 
      }, { status })
    }
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

    const lambdaResponse = await lambdaAPI.put(`/saved-searches/${id}`, {
      name: name.trim(),
      filters: typeof filters === 'string' ? filters : JSON.stringify(filters),
    })

    if (lambdaResponse.success && lambdaResponse.data) {
      return NextResponse.json(lambdaResponse.data)
    }

    const status = lambdaResponse.error?.includes('not found') ? 404 : 500
    return NextResponse.json({ 
      error: lambdaResponse.error || 'Failed to update saved search' 
    }, { status })
  } catch (error) {
    console.error('Error updating saved search:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}