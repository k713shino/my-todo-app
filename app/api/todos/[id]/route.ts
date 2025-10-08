import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { lambdaDB } from '@/lib/lambda-db'
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
    
    // Lambda API経由でTodoを更新（4ステータス専用）
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
    
    // 4ステータス専用対応: statusフィールドのみサポート
    if (body.status !== undefined) {
      (updateData as Record<string, unknown>).status = body.status
      console.log('📊 4ステータス更新:', {
        todoId: id,
        status: body.status
      })
    }
    
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
      // タグ正規化（CSV/配列両対応）
      const dataRecord = lambdaResponse.data as Record<string, unknown>
      const normalizedTags = Array.isArray(dataRecord.tags)
        ? dataRecord.tags
        : (typeof dataRecord.tags === 'string'
            ? dataRecord.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
            : [])

      const updatedTodo = {
        ...dataRecord,
        createdAt: safeToISOString(dataRecord.createdAt as Record<string, unknown>),
        updatedAt: safeToISOString(dataRecord.updatedAt as Record<string, unknown>),
        dueDate: dataRecord.dueDate ? safeToISOString(dataRecord.dueDate as Record<string, unknown>) : null,
        // ステータスが欠落するバックエンド実装に備えてフォールバック
        status: (dataRecord as { status?: string; completed?: boolean }).status || ((dataRecord as { status?: string; completed?: boolean }).completed ? 'DONE' : 'TODO'),
        category: dataRecord.category || null,
        tags: normalizedTags,
      } as Record<string, unknown>;

      console.log('✅ Lambda API でのTodo更新成功:', {
        id: updatedTodo.id,
        status: updatedTodo.status,
        completed: updatedTodo.completed
      });
      
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
    
    // まずは既存で稼働実績のある汎用エンドポイント（userIdクエリ）を試す
    const apiEndpoint = `/todos/${id}?userId=${encodeURIComponent(actualUserId)}`
    const apiResp = await lambdaAPI.delete(apiEndpoint)
    console.log('📥 LambdaAPI 削除レスポンス:', apiResp)

    let ok = apiResp.success
    let notFound = false

    // LambdaAPI 側で失敗した場合はユーザー固有エンドポイントにフォールバック
    if (!ok) {
      // ヒント: エラーメッセージに 404 が含まれるかをチェック
      notFound = typeof apiResp.error === 'string' && /404|not found/i.test(apiResp.error)
      if (notFound) {
        // 404 の場合でももう一方のエンドポイントで存在する可能性があるため試す
        console.log('🟡 汎用DELETEで404。ユーザー固有エンドポイントにフォールバック')
      } else {
        console.log('🟡 汎用DELETE失敗。ユーザー固有エンドポイントにフォールバック')
      }
      const dbResp = await lambdaDB.deleteTodo(actualUserId, String(id))
      console.log('📥 LambdaDB 削除レスポンス:', dbResp)
      ok = dbResp.success
      notFound = Boolean(notFound) || dbResp.httpStatus === 404 || (typeof dbResp.error === 'string' && /not found/i.test(dbResp.error))
    }

    if (ok) {
      console.log('✅ Todo削除成功:', id);
      
      // キャッシュ無効化
      try {
        await CacheManager.invalidateUserTodos(session.user.id)
        console.log('📦 キャッシュ無効化完了')
      } catch (cacheError) {
        console.log('⚠️ キャッシュ無効化失敗:', cacheError)
      }
      
      return NextResponse.json({ message: 'Todo deleted successfully' });
    } else {
      if (notFound) {
        // 冪等性のため、存在しない＝既に削除済みとして成功扱いにする
        console.warn(`ℹ️ Todoは既に削除済みの可能性あり（id=${id}）。成功として扱います。`)
        try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}
        return NextResponse.json({ message: 'Todo already deleted (idempotent)' })
      }
      console.error(`❌ Todo削除失敗: id=${id} status=500`)
      return NextResponse.json({ error: 'Todo削除に失敗しました' }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Lambda API接続エラー:', error);
    return NextResponse.json({ error: 'Todo削除に失敗しました' }, { status: 500 });
  }
}
