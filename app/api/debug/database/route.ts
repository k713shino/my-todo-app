import { NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getAuthSession()
    
    // 管理者のみアクセス可能
    if (!isAuthenticated(session) || session.user.email !== 'kirishima.board.projects@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔍 Database diagnostic started')

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
      },
      tests: []
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
      const errorInfo = {
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
      })
      console.error('❌ Test 2 failed:', error)
    }

    // テスト3: 現在のユーザー情報取得
    try {
      console.log('🧪 Test 3: Current user data')
      const start = Date.now()
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { _count: { select: { todos: true } } }
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
          todoCount: currentUser?._count?.todos || 0
        }
      })
      console.log('✅ Test 3 passed:', currentUser?._count)
    } catch (error) {
      diagnostics.tests.push({
        name: 'Current User Data',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ Test 3 failed:', error)
    }

    // テスト4: 接続プール状態
    try {
      console.log('🧪 Test 4: Connection pool info')
      const metrics = await prisma.$metrics.json()
      diagnostics.tests.push({
        name: 'Connection Pool',
        status: 'SUCCESS',
        metrics: metrics
      })
    } catch (error) {
      diagnostics.tests.push({
        name: 'Connection Pool',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      })
    }

    const successCount = diagnostics.tests.filter(t => t.status === 'SUCCESS').length
    const totalTests = diagnostics.tests.length

    return NextResponse.json({
      ...diagnostics,
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