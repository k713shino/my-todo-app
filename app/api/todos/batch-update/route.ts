import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaDB } from '@/lib/lambda-db'
import { CacheManager } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { ids?: string[]; data?: Record<string, any> }
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : []
    const data = body.data || {}
    if (ids.length === 0 || Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const userId = extractUserIdFromPrefixed(session.user.id)

    const updates = { updates: ids.map(id => ({ id: String(id), data })) }
    const resp = await lambdaDB.batchUpdateTodos(userId, updates)

    if (!resp.success) {
      return NextResponse.json({ error: resp.error || 'Batch update failed' }, { status: 500 })
    }

    // キャッシュ無効化
    try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}

    return NextResponse.json({ success: true, count: ids.length })
  } catch (e) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

