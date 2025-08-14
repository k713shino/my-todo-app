import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaDB } from '@/lib/lambda-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Lambda-based Debug API started')
    
    // 認証チェックを一時的に緩和（デバッグ用）
    let session = null
    try {
      session = await getAuthSession()
      console.log('📋 Session check:', {
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        isAuthenticated: isAuthenticated(session)
      })
    } catch (authError) {
      console.error('❌ Auth error:', authError)
      // 認証エラーでも診断を続行（デバッグモード）
    }

    interface TestResult {
      name: string
      status: 'SUCCESS' | 'FAILED'
      duration?: string
      result?: any
      error?: string
      code?: string
      errno?: string
      syscall?: string
      userCount?: number
      userData?: any
      metrics?: any
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL,
        region: process.env.VERCEL_REGION,
        isLambda: !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL),
        useLambdaDB: process.env.USE_LAMBDA_DB,
        lambdaApiUrl: process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL,
      },
      database: {
        urlExists: !!process.env.DATABASE_URL,
        urlLength: process.env.DATABASE_URL?.length || 0,
        urlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'Not set',
        urlPort: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).port : 'Not set',
        urlParams: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).searchParams.toString() : 'Not set',
        isAWSRDS: process.env.DATABASE_URL?.includes('rds.amazonaws.com') || false,
        hasSSL: process.env.DATABASE_URL?.includes('sslmode') || false,
        hasTimeout: process.env.DATABASE_URL?.includes('connect_timeout') || false,
        recommendations: [],
      },
      tests: [] as TestResult[]
    }

    // テスト1: Lambda API ヘルスチェック
    try {
      console.log('🧪 Test 1: Lambda API health check')
      const start = Date.now()
      const result = await lambdaDB.healthCheck()
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Lambda API Health Check',
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        result: result.data,
        error: result.error
      })
      console.log('✅ Test 1 result:', result)
    } catch (error) {
      const errorInfo: TestResult = {
        name: 'Lambda API Health Check',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        errno: (error as any)?.errno,
        syscall: (error as any)?.syscall
      }
      diagnostics.tests.push(errorInfo)
      console.error('❌ Test 1 failed:', error)
    }

    // テスト2: Lambda データベース接続テスト
    try {
      console.log('🧪 Test 2: Lambda database connection')
      const start = Date.now()
      const result = await lambdaDB.testConnection()
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Lambda Database Connection',
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        result: result.data,
        error: result.error
      })
      console.log('✅ Test 2 result:', result)
    } catch (error) {
      diagnostics.tests.push({
        name: 'Lambda Database Connection',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      } as TestResult)
      console.error('❌ Test 2 failed:', error)
    }

    // テスト3: Lambda 診断情報取得
    try {
      console.log('🧪 Test 3: Lambda diagnostics')
      const start = Date.now()
      const result = await lambdaDB.getDiagnostics()
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Lambda Diagnostics',
        status: result.success ? 'SUCCESS' : 'FAILED',
        duration: `${duration}ms`,
        result: result.data,
        error: result.error
      })
      console.log('✅ Test 3 result:', result)
    } catch (error) {
      diagnostics.tests.push({
        name: 'Lambda Diagnostics',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      } as TestResult)
      console.error('❌ Test 3 failed:', error)
    }

    // テスト4: ユーザーデータ取得テスト（セッションがある場合）
    if (session?.user?.id) {
      try {
        console.log('🧪 Test 4: User data via Lambda')
        const start = Date.now()
        const result = await lambdaDB.getUser(session.user.id)
        const duration = Date.now() - start
        
        diagnostics.tests.push({
          name: 'Lambda User Data',
          status: result.success ? 'SUCCESS' : 'FAILED',
          duration: `${duration}ms`,
          userData: {
            exists: !!result.data,
            userId: session.user.id,
            email: session.user.email
          },
          error: result.error
        })
        console.log('✅ Test 4 result:', result.success)
      } catch (error) {
        diagnostics.tests.push({
          name: 'Lambda User Data',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        } as TestResult)
        console.error('❌ Test 4 failed:', error)
      }
    } else {
      diagnostics.tests.push({
        name: 'Lambda User Data',
        status: 'FAILED',
        error: 'No valid session for user data test'
      })
    }

    const successCount = diagnostics.tests.filter(t => t.status === 'SUCCESS').length
    const totalTests = diagnostics.tests.length

    // Lambda API用の推奨設定を生成
    const recommendations = []
    if (!process.env.LAMBDA_API_URL && !process.env.NEXT_PUBLIC_LAMBDA_API_URL) {
      recommendations.push('Configure LAMBDA_API_URL environment variable')
    }
    if (process.env.USE_LAMBDA_DB !== 'true') {
      recommendations.push('Set USE_LAMBDA_DB=true to enable Lambda database access')
    }
    recommendations.push('Verify Lambda API Gateway is accessible from Vercel')
    recommendations.push('Check Lambda function logs in AWS CloudWatch')
    recommendations.push('Ensure Lambda function has proper IAM permissions for RDS')

    return NextResponse.json({
      ...diagnostics,
      database: {
        ...diagnostics.database,
        recommendations
      },
      summary: {
        totalTests,
        successCount,
        failedCount: totalTests - successCount,
        overallStatus: successCount === totalTests ? 'HEALTHY' : successCount > 0 ? 'DEGRADED' : 'FAILED',
        lambdaMode: true,
        apiUrl: process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL || 'Not configured'
      }
    })

  } catch (error) {
    console.error('🚨 Lambda diagnostic error:', error)
    return NextResponse.json({
      error: 'Lambda diagnostic failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      lambdaMode: true
    }, { status: 500 })
  }
}