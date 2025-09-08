import { NextRequest, NextResponse } from 'next/server'
import { healthCheck } from '@/lib/db-init'

// 時間追跡システムの健全性チェック
export async function GET(_request: NextRequest) {
  try {
    console.log('=== TIME TRACKING HEALTH CHECK ===')
    
    // 環境情報
    const environment = {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      isProduction: process.env.NODE_ENV === 'production'
    }
    
    console.log('Environment:', environment)

    // データベース健全性チェック
    const health = await healthCheck()
    
    const result = {
      status: health.connected && health.schemaReady ? 'healthy' : 'unhealthy',
      environment,
      database: {
        connected: health.connected,
        schemaReady: health.schemaReady,
        error: health.error
      },
      recommendations: [] as string[]
    }

    if (!health.connected) {
      result.recommendations.push('Database connection failed - check DATABASE_URL')
    }
    
    if (!health.schemaReady) {
      result.recommendations.push('TimeEntry table missing - run database migrations')
    }

    const statusCode = result.status === 'healthy' ? 200 : 503
    
    return NextResponse.json(result, { status: statusCode })
  } catch (error) {
    console.error('❌ Health check error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}