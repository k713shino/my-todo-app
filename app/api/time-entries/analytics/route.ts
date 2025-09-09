import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

// Lambda プロキシ版: 時間追跡の詳細分析データを返す
export async function GET(request: NextRequest) {
  try {
    console.log('=== TIME ANALYTICS API START (LAMBDA VERSION) ===')
    
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30', 10)
    const tz = (searchParams.get('tz') || '').trim() || undefined
    const userId = session.user.id
    // OAuth認証ユーザーIDから実際のデータベースユーザーIDを抽出
    const actualUserId = extractUserIdFromPrefixed(userId)
    const lambdaApiUrl = process.env.LAMBDA_API_URL

    console.log('Analytics request:', { userId, actualUserId, days })

    if (!lambdaApiUrl) {
      console.error('❌ LAMBDA_API_URL not configured')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 })
    }

    try {
      console.log('🚀 Calling Lambda API for time analytics')
      console.log('🔍 Lambda API URL:', `${lambdaApiUrl}/time-entries/analytics?userId=${encodeURIComponent(actualUserId)}&days=${days}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`)
      
      const response = await fetch(`${lambdaApiUrl}/time-entries/analytics?userId=${encodeURIComponent(actualUserId)}&days=${days}${tz ? `&tz=${encodeURIComponent(tz)}` : ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      console.log('Lambda response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Lambda API error:', response.status, errorText)
        return NextResponse.json({ 
          totalSeconds: 0, 
          dailyStats: [], 
          taskStats: [],
          weeklyAverage: 0,
          productivity: { bestDay: '', worstDay: '', consistency: 0 },
          error: 'Failed to get analytics data',
          details: `Lambda API returned ${response.status}`
        })
      }

      const result = await response.json()
      console.log('✅ Lambda API analytics response:', {
        totalSeconds: result.totalSeconds,
        dailyStatsCount: result.dailyStats?.length || 0,
        taskStatsCount: result.taskStats?.length || 0,
        weeklyAverage: result.weeklyAverage
      })

      return NextResponse.json(result)
    } catch (fetchError) {
      console.error('❌ Lambda API fetch error:', fetchError)
      return NextResponse.json({ 
        totalSeconds: 0, 
        dailyStats: [], 
        taskStats: [],
        weeklyAverage: 0,
        productivity: { bestDay: '', worstDay: '', consistency: 0 },
        error: 'Failed to connect to analytics service',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      })
    }
  } catch (error) {
    console.error('❌ TIME ANALYTICS API PROXY ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 常にデフォルト値を返す
    return NextResponse.json({ 
      totalSeconds: 0, 
      dailyStats: [], 
      taskStats: [],
      weeklyAverage: 0,
      productivity: { bestDay: '', worstDay: '', consistency: 0 }
    })
  }
}
