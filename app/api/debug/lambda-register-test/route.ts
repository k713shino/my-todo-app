import { NextRequest, NextResponse } from 'next/server'

/**
 * 🔍 Lambda API登録エンドポイントのテスト用API
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Lambda API登録エンドポイントテスト開始')
    
    if (!process.env.LAMBDA_API_URL) {
      return NextResponse.json({
        success: false,
        error: 'LAMBDA_API_URL not configured'
      }, { status: 500 })
    }
    
    const testResult = {
      lambdaApiUrl: process.env.LAMBDA_API_URL,
      registerEndpoint: `${process.env.LAMBDA_API_URL}/auth/register`,
      test: 'pending'
    }
    
    console.log('🔍 Lambda API登録エンドポイント情報:', testResult)
    
    // OPTIONSリクエストでエンドポイントの存在確認
    try {
      const optionsResponse = await fetch(`${process.env.LAMBDA_API_URL}/auth/register`, {
        method: 'OPTIONS',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log('📥 OPTIONS レスポンス:', {
        status: optionsResponse.status,
        statusText: optionsResponse.statusText,
        headers: Object.fromEntries(optionsResponse.headers.entries())
      })
      
      Object.assign(testResult, {
        test: 'options_completed',
        optionsStatus: optionsResponse.status,
        optionsHeaders: Object.fromEntries(optionsResponse.headers.entries())
      })
      
    } catch (optionsError) {
      console.error('❌ OPTIONS リクエストエラー:', optionsError)
      Object.assign(testResult, {
        test: 'options_failed',
        optionsError: optionsError instanceof Error ? optionsError.message : String(optionsError)
      })
    }
    
    // 簡易テストリクエスト（無効なデータで404/400確認）
    try {
      const testResponse = await fetch(`${process.env.LAMBDA_API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: 'endpoint_check'
        })
      })
      
      const responseText = await testResponse.text()
      
      console.log('📥 テストPOST レスポンス:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        responseText: responseText.substring(0, 200)
      })
      
      Object.assign(testResult, {
        test: 'post_completed',
        postStatus: testResponse.status,
        postResponse: responseText.substring(0, 200),
        endpointExists: testResponse.status !== 404
      })
      
    } catch (postError) {
      console.error('❌ テストPOST エラー:', postError)
      Object.assign(testResult, {
        test: 'post_failed',
        postError: postError instanceof Error ? postError.message : String(postError)
      })
    }
    
    return NextResponse.json({
      success: true,
      test: testResult
    })
    
  } catch (error) {
    console.error('💥 Lambda APIテスト自体でエラー:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : undefined
      }
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'