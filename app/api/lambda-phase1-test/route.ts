import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Phase 1 Lambda接続テスト開始')
    
    const lambdaUrl = process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL
    
    if (!lambdaUrl) {
      return NextResponse.json({
        success: false,
        error: 'LAMBDA_API_URL not configured',
        phase: 'phase-1-test'
      }, { status: 500 })
    }
    
    console.log(`🔗 Testing Lambda endpoint: ${lambdaUrl}`)
    
    // Phase 1 ヘルスチェック + DB接続テスト
    const response = await fetch(lambdaUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // タイムアウト設定
      signal: AbortSignal.timeout(10000) // 10秒
    })
    
    console.log(`📊 Lambda response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Lambda API error: ${response.status} - ${errorText}`)
      
      return NextResponse.json({
        success: false,
        error: `Lambda API returned ${response.status}`,
        details: errorText,
        phase: 'phase-1-test'
      }, { status: response.status })
    }
    
    const data = await response.json()
    console.log('✅ Lambda API response received:', data)
    
    // Phase 1の期待される形式かチェック
    const isPhase1Response = data.version === 'phase-1-db-connection' && data.database
    
    return NextResponse.json({
      success: true,
      phase: 'phase-1-test',
      lambda_response: data,
      analysis: {
        is_phase1_version: isPhase1Response,
        database_connected: data.database?.success || false,
        ssl_enabled: data.database?.performance?.ssl_enabled || false,
        connection_time_ms: data.database?.performance?.connection_time_ms || null,
        available_endpoints: data.availableEndpoints || []
      },
      test_timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('💥 Phase 1 test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      phase: 'phase-1-test',
      test_timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// テスト用のユーザー登録API呼び出し
export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Phase 1 ユーザー登録テスト開始')
    
    const body = await request.json()
    const { email, password, name } = body
    
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required for test',
        phase: 'phase-1-user-registration-test'
      }, { status: 400 })
    }
    
    const lambdaUrl = process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL
    
    if (!lambdaUrl) {
      return NextResponse.json({
        success: false,
        error: 'LAMBDA_API_URL not configured',
        phase: 'phase-1-user-registration-test'
      }, { status: 500 })
    }
    
    const registerUrl = `${lambdaUrl}/auth/register`
    console.log(`🔗 Testing Lambda user registration: ${registerUrl}`)
    
    const response = await fetch(registerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name: name || `Test User ${Date.now()}`
      }),
      signal: AbortSignal.timeout(15000) // 15秒
    })
    
    console.log(`📊 Lambda registration response status: ${response.status}`)
    
    const data = await response.json()
    console.log('📝 Lambda registration response:', data)
    
    return NextResponse.json({
      success: response.ok,
      status: response.status,
      phase: 'phase-1-user-registration-test',
      lambda_response: data,
      analysis: {
        registration_successful: response.ok && data.user,
        user_created: !!data.user,
        has_user_id: !!(data.user?.id),
        response_time_ok: true // TODO: 実装可能であれば応答時間を測定
      },
      test_timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('💥 Phase 1 user registration test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      phase: 'phase-1-user-registration-test',
      test_timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}