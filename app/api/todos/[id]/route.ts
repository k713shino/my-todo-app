import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { safeToISOString } from '@/lib/date-utils'
import { CacheManager } from '@/lib/cache'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

/**
 * PUT: Todo更新API (Lambda経由)
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

    console.log('🔄 Lambda API経由でTodo更新を試行:', id);
    
    // Lambda API経由でTodoを更新 (TEXT型対応)
    const updateData = {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate }),
      ...(body.category !== undefined && { category: body.category?.trim() || null }),
      ...(body.tags !== undefined && { 
        tags: Array.isArray(body.tags)
          ? body.tags.map((tag: string) => tag.trim()).filter(Boolean)
          : []
      }),
      userId: extractUserIdFromPrefixed(session.user.id) // 必須: ユーザー認証用（実際のユーザーID）
    }
    
    // 一時的な対応: データベースマイグレーション前はcompletedフィールドを使用
    if (body.completed !== undefined) {
      (updateData as any).completed = body.completed
      console.log('🔄 completed フィールドで更新:', body.completed)
    }
    
    // TODO: データベースマイグレーション後はこちらに切り替え
    // if (body.status !== undefined) {
    //   updateData.status = body.status
    // } else if (body.completed !== undefined) {
    //   updateData.status = body.completed ? 'DONE' : 'TODO'
    // }
    
    console.log('📤 Lambda API更新データ:', { 
      todoId: id, 
      userId: session.user.id, 
      actualUserId: extractUserIdFromPrefixed(session.user.id),
      updateFields: Object.keys(updateData) 
    })

    const lambdaResponse = await lambdaAPI.put(`/todos/${id}`, updateData);
    console.log('📥 Lambda API更新レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success && lambdaResponse.data) {
      // レスポンスデータの安全な日付変換
      const updatedTodo = {
        ...lambdaResponse.data,
        createdAt: safeToISOString(lambdaResponse.data.createdAt),
        updatedAt: safeToISOString(lambdaResponse.data.updatedAt),
        dueDate: lambdaResponse.data.dueDate ? safeToISOString(lambdaResponse.data.dueDate) : null,
      };
      
      console.log('✅ Lambda API でのTodo更新成功:', updatedTodo.id);
      
      // キャッシュ無効化
      try {
        await CacheManager.invalidateUserTodos(session.user.id)
        console.log('📦 キャッシュ無効化完了')
      } catch (cacheError) {
        console.log('⚠️ キャッシュ無効化失敗:', cacheError)
      }
      
      return NextResponse.json(updatedTodo);
    } else {
      console.error('❌ Lambda API更新失敗:', lambdaResponse.error);
      return NextResponse.json({ error: lambdaResponse.error || 'Todo更新に失敗しました' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Lambda API接続エラー:', error);
    return NextResponse.json({ error: 'Todo更新に失敗しました' }, { status: 500 });
  }
}

/**
 * DELETE: Todo削除API (Lambda経由)
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

    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    
    console.log('🔄 Lambda API経由でTodo削除を試行:', id);
    console.log('📤 削除リクエスト詳細:', { 
      todoId: id, 
      userId: session.user.id, 
      actualUserId,
      userIdType: typeof session.user.id 
    });
    
    // Lambda API経由でTodoを削除 (実際のuserIdをクエリパラメータで送信、TEXT型対応)
    const deleteEndpoint = `/todos/${id}?userId=${encodeURIComponent(actualUserId)}`
    console.log('🔗 削除エンドポイント:', deleteEndpoint);
    
    const lambdaResponse = await lambdaAPI.delete(deleteEndpoint);
    console.log('📥 Lambda API削除レスポンス:', lambdaResponse);
    
    if (lambdaResponse.success) {
      console.log('✅ Lambda API でのTodo削除成功:', id);
      
      // キャッシュ無効化
      try {
        await CacheManager.invalidateUserTodos(session.user.id)
        console.log('📦 キャッシュ無効化完了')
      } catch (cacheError) {
        console.log('⚠️ キャッシュ無効化失敗:', cacheError)
      }
      
      return NextResponse.json({ message: 'Todo deleted successfully' });
    } else {
      console.error('❌ Lambda API削除失敗:', lambdaResponse.error);
      // 404エラーの場合は適切なステータスコードを返す
      const status = lambdaResponse.error?.includes('not found') ? 404 : 500;
      return NextResponse.json({ error: lambdaResponse.error || 'Todo削除に失敗しました' }, { status });
    }

  } catch (error) {
    console.error('❌ Lambda API接続エラー:', error);
    return NextResponse.json({ error: 'Todo削除に失敗しました' }, { status: 500 });
  }
}