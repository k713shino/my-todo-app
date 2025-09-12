import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CacheManager } from '@/lib/cache'

// ヘルスチェック API エンドポイント
// データベースとRedisの接続状況、レスポンス時間、メモリ使用量などを監視
export async function GET() {
  try {
    const startTime = Date.now()
    
    // データベース接続確認
    let databaseStatus = 'healthy'
    let databaseLatency = 0
    try {
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      databaseLatency = Date.now() - dbStart
    } catch (error) {
      databaseStatus = 'unhealthy'
      console.error('Database health check failed:', error)
    }
    
    // 🔴 Redis接続確認
    let redisStatus = 'healthy'
    let redisLatency = 0
    try {
      const redisHealth = await CacheManager.healthCheck()
      redisStatus = redisHealth.status
      redisLatency = redisHealth.latency
    } catch (error) {
      redisStatus = 'unhealthy'
      console.error('Redis health check failed:', error)
    }
    
    const totalResponseTime = Date.now() - startTime
    
    // 全体の状態判定
    const overallStatus = (databaseStatus === 'healthy' && redisStatus === 'healthy') 
      ? 'healthy' 
      : 'unhealthy'
    
    const health = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: totalResponseTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV,
      checks: {
        database: {
          status: databaseStatus,
          latency: databaseLatency
        },
        redis: {
          status: redisStatus,
          latency: redisLatency
        }
      },
      metrics: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 503
    
    return NextResponse.json(health, { status: statusCode })
  } catch (error) {
    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: { status: 'unknown' },
        redis: { status: 'unknown' }
      }
    }
    
    return NextResponse.json(health, { status: 503 })
  }
}