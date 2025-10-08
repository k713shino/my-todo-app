import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

// 現在計測中のエントリを返す（todoIdと開始時刻）
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ _error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tz = (searchParams.get('tz') || '').trim() || undefined
    const userId = session.user.id
    const actualUserId = extractUserIdFromPrefixed(userId)
    const lambdaApiUrl = process.env.LAMBDA_API_URL

    if (!lambdaApiUrl) {
      return NextResponse.json({ _error: 'Service configuration _error' }, { status: 503 })
    }

    const url = `${lambdaApiUrl}/time-entries/active?userId=${encodeURIComponent(actualUserId)}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`
    const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } })
    if (!resp.ok) {
      return NextResponse.json({ running: false })
    }
    const data = await resp.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ running: false })
  }
}
