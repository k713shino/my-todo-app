import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'

// Lambda プロキシ版: 今日/今週の合計時間（秒）を返す
export async function GET(_request: NextRequest) {
  try {
    console.log('=== TIME SUMMARY API PROXY (LAMBDA) ===')
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      LAMBDA_API_URL: process.env.LAMBDA_API_URL ? 'SET' : 'NOT_SET'
    })
    
    // セッション認証
    const session = await getAuthSession()
    console.log('Session check:', { hasSession: !!session, hasUser: !!session?.user, userId: session?.user?.id })
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    // OAuth認証ユーザーIDから実際のデータベースユーザーIDを抽出
    const actualUserId = extractUserIdFromPrefixed(userId)
    console.log('🔄 User ID mapping for time summary:', { userId, actualUserId })
    
    const lambdaApiUrl = process.env.LAMBDA_API_URL

    if (!lambdaApiUrl) {
      console.error('❌ LAMBDA_API_URL not configured')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 })
    }

    try {
      console.log('🚀 Calling Lambda API for time summary')
      console.log('🔍 Lambda API URL:', `${lambdaApiUrl}/time-entries/summary?userId=${encodeURIComponent(actualUserId)}`)
      console.log('👤 User ID:', actualUserId)
      
      const response = await fetch(`${lambdaApiUrl}/time-entries/summary?userId=${encodeURIComponent(actualUserId)}`, {
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
          todaySeconds: 0, 
          weekSeconds: 0, 
          error: 'Failed to get time summary',
          details: `Lambda API returned ${response.status}`
        })
      }

      const result = await response.json()
      console.log('✅ Lambda API response:', result)

      return NextResponse.json(result)
    } catch (fetchError) {
      console.error('❌ Lambda API fetch error:', fetchError)
      return NextResponse.json({ 
        todaySeconds: 0, 
        weekSeconds: 0, 
        error: 'Failed to connect to time tracking service',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      })
    }
  } catch (error) {
    console.error('❌ TIME SUMMARY API PROXY ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // 緊急フォールバック - 常にデフォルト値を返す
    return NextResponse.json({ todaySeconds: 0, weekSeconds: 0 })
  }
}