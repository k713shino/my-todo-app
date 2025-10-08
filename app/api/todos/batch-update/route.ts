import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaDB } from '@/lib/lambda-db'
import { CacheManager } from '@/lib/cache'
import { lambdaAPI } from '@/lib/lambda-api'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { ids?: string[]; data?: Record<string, unknown> }
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
    const data = body.data || {}
    if (ids.length === 0 || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const userId = extractUserIdFromPrefixed(session.user.id)

    // まずはバッチAPIを試行
    const updates = { updates: ids.map(id => ({ id: String(id), data })) }
    const resp = await lambdaDB.batchUpdateTodos(userId, updates)

    let ok = 0
    let fail = 0

    if (resp.success) {
      ok = ids.length
    } else {
      // フォールバック: エンドポイント未実装などの場合は1件ずつ更新
      const notFound = (resp.httpStatus === 404) || (typeof resp.error === 'string' && /Endpoint not found|404/i.test(resp.error))
      if (!notFound) {
        return NextResponse.json({ error: resp.error || 'Batch update failed' }, { status: 500 })
      }

      // 並列度を制限して更新
      const limit = Math.max(1, Math.min(10, Number(process.env.BULK_UPDATE_CONCURRENCY || 5)))
      let cursor = 0
      const workers = new Array(Math.min(limit, ids.length)).fill(0).map(async () => {
        while (true) {
          const index = cursor++
          if (index >= ids.length) break
          const id = String(ids[index])
          // 既存で実績のある汎用エンドポイントへPUT
          const updateData = { ...data, userId }
          const res = await lambdaAPI.put(`/todos/${id}`, updateData)
          if (res.success) ok++
          else fail++
        }
      })
      await Promise.all(workers)
    }

    // キャッシュ無効化
    try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}

    return NextResponse.json({ success: true, count: ok, failed: fail })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
