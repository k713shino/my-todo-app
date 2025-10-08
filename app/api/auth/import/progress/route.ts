import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = extractUserIdFromPrefixed(session.user.id)
    const { searchParams } = new URL(request.url)
    const importId = searchParams.get('importId')
    if (!importId) return NextResponse.json({ error: 'importId required' }, { status: 400 })
    const baseKey = `import:${userId}:${importId}`
    const statusRaw = await redis.get(`${baseKey}:status`)
    if (!statusRaw) return NextResponse.json({ error: 'Import not found or expired' }, { status: 404 })
    const status = JSON.parse(statusRaw)
    return NextResponse.json({ importId, ...status })
  } catch (e) {
    const error = e as Error
    return NextResponse.json({ error: error?.message || 'Progress failed' }, { status: 500 })
  }
}

