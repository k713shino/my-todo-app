import { NextResponse } from 'next/server'
import { lambdaDB } from '@/lib/lambda-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Lambda API test started')
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
      environment: {
        lambdaApiUrl: process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL,
        useLambdaDB: process.env.USE_LAMBDA_DB,
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL
      }
    }

    // テスト1: 簡単な接続確認
    console.log('🧪 Testing basic Lambda API connectivity...')
    try {
      const start = Date.now()
      
      // 基本的なfetch テスト
      const response = await fetch(`${process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10秒タイムアウト
      })
      
      const duration = Date.now() - start
      const responseText = await response.text()
      
      results.tests.push({
        name: 'Direct Fetch Test',
        status: response.ok ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        httpStatus: response.status,
        responseText: responseText.substring(0, 200), // 最初の200文字のみ
        headers: Object.fromEntries(response.headers.entries())
      })
      
      console.log(`✅ Direct fetch test: ${response.status} in ${duration}ms`)
    } catch (error) {
      results.tests.push({
        name: 'Direct Fetch Test',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code
      })
      console.error('❌ Direct fetch failed:', error)
    }

    // テスト2: Lambda DB ヘルスチェック
    console.log('🧪 Testing Lambda DB health check...')
    try {
      const start = Date.now()
      const result = await lambdaDB.healthCheck()
      const duration = Date.now() - start
      
      results.tests.push({
        name: 'Lambda DB Health Check',
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        result: result.data,
        error: result.error
      })
      
      console.log(`✅ Lambda DB health: ${result.success} in ${duration}ms`)
    } catch (error) {
      results.tests.push({
        name: 'Lambda DB Health Check',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ Lambda DB health check failed:', error)
    }

    // テスト3: データベース接続テスト
    console.log('🧪 Testing Lambda database connection...')
    try {
      const start = Date.now()
      const result = await lambdaDB.testConnection()
      const duration = Date.now() - start
      
      results.tests.push({
        name: 'Lambda Database Connection',
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        result: result.data,
        error: result.error
      })
      
      console.log(`✅ Lambda DB connection: ${result.success} in ${duration}ms`)
    } catch (error) {
      results.tests.push({
        name: 'Lambda Database Connection',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ Lambda DB connection failed:', error)
    }

    const successCount = results.tests.filter(t => t.status === 'SUCCESS').length
    const totalTests = results.tests.length

    return NextResponse.json({
      ...results,
      summary: {
        totalTests,
        successCount,
        failedCount: totalTests - successCount,
        overallStatus: successCount === totalTests ? 'HEALTHY' : successCount > 0 ? 'DEGRADED' : 'FAILED'
      }
    })

  } catch (error) {
    console.error('🚨 Lambda test error:', error)
    return NextResponse.json({
      error: 'Lambda test failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}