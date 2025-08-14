import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Lambda API endpoints discovery started')
    
    const baseUrl = process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL
    if (!baseUrl) {
      return NextResponse.json({
        error: 'Lambda API URL not configured',
        environment: {
          LAMBDA_API_URL: process.env.LAMBDA_API_URL || 'Not set',
          NEXT_PUBLIC_LAMBDA_API_URL: process.env.NEXT_PUBLIC_LAMBDA_API_URL || 'Not set'
        }
      }, { status: 400 })
    }

    const results = {
      timestamp: new Date().toISOString(),
      baseUrl,
      tests: [] as any[]
    }

    // 一般的なエンドポイントをテスト
    const endpointsToTest = [
      '', // ルート
      '/',
      '/health',
      '/status',
      '/ping',
      '/api',
      '/v1',
      '/prod',
      '/test',
      '/users',
      '/database/test',
      '/database',
      '/db/test',
      '/todos'
    ]

    for (const endpoint of endpointsToTest) {
      try {
        const url = `${baseUrl}${endpoint}`
        console.log(`🧪 Testing endpoint: ${url}`)
        
        const start = Date.now()
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(5000) // 5秒タイムアウト
        })
        
        const duration = Date.now() - start
        let responseData = ''
        
        try {
          responseData = await response.text()
        } catch (e) {
          responseData = 'Could not read response body'
        }

        results.tests.push({
          endpoint,
          url,
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          duration: `${duration}ms`,
          responsePreview: responseData.substring(0, 300), // 最初の300文字
          headers: Object.fromEntries(response.headers.entries()),
          contentType: response.headers.get('content-type')
        })

        if (response.ok) {
          console.log(`✅ ${endpoint}: ${response.status} (${duration}ms)`)
        } else {
          console.log(`❌ ${endpoint}: ${response.status} ${response.statusText} (${duration}ms)`)
        }
        
      } catch (error) {
        results.tests.push({
          endpoint,
          url: `${baseUrl}${endpoint}`,
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
          code: (error as any)?.code
        })
        console.error(`💥 ${endpoint}:`, error)
      }
    }

    // 結果を分析
    const workingEndpoints = results.tests.filter(t => t.ok === true)
    const notFoundEndpoints = results.tests.filter(t => t.status === 404)
    const errorEndpoints = results.tests.filter(t => t.status === 'ERROR')

    const analysis = {
      total: results.tests.length,
      working: workingEndpoints.length,
      notFound: notFoundEndpoints.length,
      errors: errorEndpoints.length,
      workingEndpoints: workingEndpoints.map(e => e.endpoint),
      recommendations: [] as string[]
    }

    // 推奨事項を生成
    if (workingEndpoints.length === 0) {
      analysis.recommendations.push('No working endpoints found - check if Lambda function is deployed')
      analysis.recommendations.push('Verify Lambda API Gateway URL is correct')
      analysis.recommendations.push('Check AWS Lambda function logs for errors')
    } else {
      analysis.recommendations.push(`Found ${workingEndpoints.length} working endpoint(s)`)
      analysis.recommendations.push('Use working endpoints to build correct API paths')
    }

    if (errorEndpoints.length > 0) {
      analysis.recommendations.push('Network connectivity issues detected')
      analysis.recommendations.push('Check if Lambda API Gateway allows CORS')
    }

    return NextResponse.json({
      ...results,
      analysis,
      suggestions: {
        nextSteps: [
          'Use working endpoints to update Lambda DB configuration',
          'Check AWS CloudWatch logs for Lambda function details',
          'Verify API Gateway stage configuration',
          'Test endpoints manually in browser or Postman'
        ]
      }
    })

  } catch (error) {
    console.error('🚨 Lambda endpoints discovery error:', error)
    return NextResponse.json({
      error: 'Lambda endpoints discovery failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}