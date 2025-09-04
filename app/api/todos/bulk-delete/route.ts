import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaDB } from '@/lib/lambda-db'
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
      const res = await lambdaDB.deleteTodo(userId, String(id))
      if (res.success || (res.httpStatus === 404 || (typeof res.error === 'string' && /not found/i.test(res.error || '')))) {
        ok++
      } else {
        fail++
      }
    }, limit)

    try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}

    return NextResponse.json({ success: true, deleted: ok, failed: fail })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

