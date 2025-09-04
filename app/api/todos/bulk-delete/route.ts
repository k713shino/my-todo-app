import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaDB } from '@/lib/lambda-db'
import { lambdaAPI } from '@/lib/lambda-api'
import { CacheManager } from '@/lib/cache'

export const dynamic = 'force-dynamic'

const runWithConcurrency = async <T,>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  limit: number
) => {
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const myIndex = cursor++
      if (myIndex >= items.length) break
      await worker(items[myIndex], myIndex)
    }
  })
  await Promise.all(workers)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({})) as { ids?: string[]; concurrency?: number }
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const limit = Math.max(1, Math.min(10, Number(body.concurrency || process.env.BULK_DELETE_CONCURRENCY || 5)))
    const userId = extractUserIdFromPrefixed(session.user.id)

    let ok = 0
    let fail = 0

    await runWithConcurrency(ids, async (id) => {
      const tid = String(id)
      // 1) 既存で実績のある汎用エンドポイント（クエリに userId）を優先
      const apiResp = await lambdaAPI.delete(`/todos/${encodeURIComponent(tid)}?userId=${encodeURIComponent(userId)}`)
      if (apiResp.success) { ok++; return }
      const apiNotFound = typeof apiResp.error === 'string' && /not found/i.test(apiResp.error)
      const apiEndpointMissing = typeof apiResp.error === 'string' && /Endpoint not found|404/.test(apiResp.error)
      if (apiNotFound) { ok++; return }

      // 2) フォールバック: ユーザー固有エンドポイント
      const dbResp = await lambdaDB.deleteTodo(userId, tid)
      if (dbResp.success) { ok++; return }
      const dbNotFound = (dbResp.httpStatus === 404) || (typeof dbResp.error === 'string' && /not found/i.test(dbResp.error))
      if (dbNotFound) { ok++; return }

      // どちらも失敗
      fail++
    }, limit)

    try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}

    return NextResponse.json({ success: true, deleted: ok, failed: fail })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
