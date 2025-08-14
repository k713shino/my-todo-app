import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Debug API accessed')
    
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
    
    // 開発用：認証をスキップしてデバッグ実行
    if (!session || !isAuthenticated(session)) {
      console.warn('⚠️ Running in debug mode without proper authentication')
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Database diagnostic started')

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

    // テスト1: 基本的な接続テスト
    try {
      console.log('🧪 Test 1: Basic connection')
      const start = Date.now()
      const result = await Promise.race([
        prisma.$queryRaw`SELECT 1 as test, NOW() as server_time`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 15 seconds')), 15000)
        )
      ])
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Basic Connection',
        status: 'SUCCESS',
        duration: `${duration}ms`,
        result: result
      })
      console.log('✅ Test 1 passed:', result)
    } catch (error) {
      const errorInfo: TestResult = {
        name: 'Basic Connection',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        errno: (error as any)?.errno,
        syscall: (error as any)?.syscall
      }
      diagnostics.tests.push(errorInfo)
      console.error('❌ Test 1 failed:', error)
    }

    // テスト2: ユーザーテーブル確認
    try {
      console.log('🧪 Test 2: User table access')
      const start = Date.now()
      const userCount = await prisma.user.count()
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'User Table Access',
        status: 'SUCCESS',
        duration: `${duration}ms`,
        userCount: userCount
      })
      console.log('✅ Test 2 passed, user count:', userCount)
    } catch (error) {
      diagnostics.tests.push({
        name: 'User Table Access',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      } as TestResult)
      console.error('❌ Test 2 failed:', error)
    }

    // テスト3: 現在のユーザー情報取得
    try {
      console.log('🧪 Test 3: Current user data')
      const start = Date.now()
      
      // セッションがない場合は最初のユーザーを取得
      const userId = session?.user?.id || 'test-user'
      const currentUser = await prisma.user.findFirst({
        include: { _count: { select: { todos: true } } },
        ...(session?.user?.id && { where: { id: session.user.id } })
      })
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Current User Data',
        status: 'SUCCESS',
        duration: `${duration}ms`,
        userData: {
          exists: !!currentUser,
          id: currentUser?.id,
          email: currentUser?.email,
          todoCount: currentUser?._count?.todos || 0,
          sessionUserId: session?.user?.id || 'No session'
        }
      })
      console.log('✅ Test 3 passed:', currentUser?._count)
    } catch (error) {
      diagnostics.tests.push({
        name: 'Current User Data',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      } as TestResult)
      console.error('❌ Test 3 failed:', error)
    }

    // テスト4: データベース情報取得
    try {
      console.log('🧪 Test 4: Database info')
      const start = Date.now()
      
      // データベースサイズとテーブル情報を取得
      const dbInfo = await prisma.$queryRaw`
        SELECT 
          current_database() as database_name,
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          count(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `
      
      const duration = Date.now() - start
      
      diagnostics.tests.push({
        name: 'Database Info',
        status: 'SUCCESS',
        duration: `${duration}ms`,
        result: dbInfo
      })
      console.log('✅ Test 4 passed:', dbInfo)
    } catch (error) {
      diagnostics.tests.push({
        name: 'Database Info',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      } as TestResult)
      console.error('❌ Test 4 failed:', error)
    }

    const successCount = diagnostics.tests.filter(t => t.status === 'SUCCESS').length
    const totalTests = diagnostics.tests.length

    // AWS RDS用の推奨設定を生成
    const recommendations = []
    if (diagnostics.database.isAWSRDS) {
      if (!diagnostics.database.hasSSL) {
        recommendations.push('Add sslmode=require for AWS RDS security')
      }
      if (!diagnostics.database.hasTimeout) {
        recommendations.push('Add connect_timeout=30 for Vercel/Lambda')
      }
      recommendations.push('Check AWS RDS instance status')
      recommendations.push('Verify Security Group allows Vercel IPs')
      recommendations.push('Ensure RDS is publicly accessible')
    }

    // 修正されたDATABASE_URL例を提供
    const currentUrl = process.env.DATABASE_URL
    let suggestedUrl = ''
    if (currentUrl) {
      try {
        const url = new URL(currentUrl)
        url.searchParams.set('sslmode', 'require')
        url.searchParams.set('connect_timeout', '30')
        url.searchParams.set('socket_timeout', '30')
        suggestedUrl = url.toString()
      } catch (e) {
        suggestedUrl = 'Invalid URL format'
      }
    }

    return NextResponse.json({
      ...diagnostics,
      database: {
        ...diagnostics.database,
        recommendations,
        suggestedDatabaseUrl: suggestedUrl
      },
      summary: {
        totalTests,
        successCount,
        failedCount: totalTests - successCount,
        overallStatus: successCount === totalTests ? 'HEALTHY' : successCount > 0 ? 'DEGRADED' : 'FAILED'
      }
    })

  } catch (error) {
    console.error('🚨 Diagnostic error:', error)
    return NextResponse.json({
      error: 'Diagnostic failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}