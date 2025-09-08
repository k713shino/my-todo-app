import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'

// Lambda プロキシ版: タスクの時間計測を開始
export async function POST(request: NextRequest) {
  try {
    console.log('=== TIME START API PROXY (LAMBDA) ===')
    console.log('Environment:', {
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

    const { todoId } = await request.json()
    console.log('Request data:', { todoId })
    
    if (!todoId) {
      console.log('❌ Missing todoId')
      return NextResponse.json({ error: 'todoId is required' }, { status: 400 })
    }

    const userId = session.user.id
    const lambdaApiUrl = process.env.LAMBDA_API_URL

    if (!lambdaApiUrl) {
      console.error('❌ LAMBDA_API_URL not configured')
      return NextResponse.json({ error: 'Service configuration error' }, { status: 503 })
    }

    try {
      console.log('🚀 Calling Lambda API for time tracking start')
      
      const response = await fetch(`${lambdaApiUrl}/time-entries/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          todoId
        })
      })

      console.log('Lambda response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Lambda API error:', response.status, errorText)
        return NextResponse.json({ 
          error: 'Failed to start time tracking',
          details: `Lambda API returned ${response.status}`
        }, { status: response.status })
      }

      const result = await response.json()
      console.log('✅ Lambda API response:', result)

      return NextResponse.json(result)
    } catch (fetchError) {
      console.error('❌ Lambda API fetch error:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to connect to time tracking service',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
      }, { status: 503 })
    }
  } catch (error) {
    console.error('❌ TIME START API PROXY ERROR:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    // エラー時のフォールバック
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}