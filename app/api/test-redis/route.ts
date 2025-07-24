import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { CacheManager } from '@/lib/cache'

export async function GET() {
  try {
    console.log('🔍 Redis接続テスト開始...')
    
    // 環境変数チェック
    const redisUrl = process.env.REDIS_URL
    console.log('Redis URL存在:', !!redisUrl)
    console.log('Redis URL type:', redisUrl?.includes('upstash') ? 'Upstash' : 'Local')
    
    // 基本接続テスト
    const startTime = Date.now()
    const pong = await redis.ping()
    const latency = Date.now() - startTime
    console.log('✅ Redis ping:', pong, `(${latency}ms)`)
    
    // 書き込みテスト
    const testKey = 'test:connection'
    const testData = { 
      message: 'Hello Upstash!', 
      timestamp: new Date().toISOString(),
      test: true 
    }
    
    await CacheManager.set(testKey, testData, 60)
    console.log('✅ データ書き込み完了')
    
    // 読み込みテスト
    const cached = await CacheManager.get(testKey)
    console.log('✅ データ読み込み完了:', !!cached)
    
    // 使用量チェック
    const usage = await CacheManager.checkUsage()
    console.log('📊 Redis使用量:', usage)
    
    // Redisインフォメーション取得
    const info = await redis.info('server')
    const versionMatch = info.match(/redis_version:([^\r\n]+)/)
    const redisVersion = versionMatch ? versionMatch[1] : 'unknown'
    
    // 総キー数
    const totalKeys = await redis.dbsize()
    
    // テストキー削除
    await redis.del(testKey)
    console.log('🧹 テストキークリーンアップ完了')
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      redis: {
        ping: pong,
        latency: `${latency}ms`,
        version: redisVersion,
        totalKeys: totalKeys,
        url: redisUrl ? 'configured' : 'missing'
      },
      cache: {
        testWrite: true,
        testRead: !!cached,
        testData: cached
      },
      usage: usage,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1',
        upstash: redisUrl?.includes('upstash') || false
      }
    })
  } catch (error) {
    console.error('❌ Redis接続テストエラー:', error)
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'UnknownError',
        stack: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL === '1',
        hasRedisUrl: !!process.env.REDIS_URL,
        redisUrlType: process.env.REDIS_URL?.includes('upstash') ? 'Upstash' : 'Other'
      },
      troubleshooting: {
        suggestions: [
          'REDIS_URL環境変数が正しく設定されているか確認',
          'Upstashダッシュボードでデータベース状態を確認',
          'ネットワーク接続とファイアウォール設定を確認',
          'TLS証明書の問題がないか確認'
        ]
      }
    }, { status: 500 })
  }
}

// POST メソッド - キャッシュクリア用
export async function POST() {
  try {
    console.log('🧹 Redisキャッシュクリア開始...')
    
    // テストキーのみクリア
    const testKeys = await redis.keys('test:*')
    if (testKeys.length > 0) {
      await redis.del(...testKeys)
      console.log(`🗑️ ${testKeys.length}個のテストキーを削除`)
    }
    
    // 古いキーのクリーンアップ
    const cleanedCount = await CacheManager.cleanupOldKeys()
    
    // 使用量再チェック
    const usage = await CacheManager.checkUsage()
    
    return NextResponse.json({
      status: 'success',
      action: 'cache_cleanup',
      timestamp: new Date().toISOString(),
      result: {
        testKeysDeleted: testKeys.length,
        oldKeysDeleted: cleanedCount,
        totalDeleted: testKeys.length + cleanedCount
      },
      usage: usage
    })
  } catch (error) {
    console.error('❌ キャッシュクリアエラー:', error)
    
    return NextResponse.json({
      status: 'error',
      action: 'cache_cleanup',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE メソッド - 全キャッシュクリア（危険）
export async function DELETE() {
  try {
    // 開発環境のみ許可
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({
        status: 'error',
        error: 'Full cache flush is not allowed in production'
      }, { status: 403 })
    }
    
    console.log('⚠️ 全キャッシュクリア実行...')
    
    // 全データベースクリア
    await redis.flushdb()
    
    return NextResponse.json({
      status: 'success',
      action: 'full_flush',
      timestamp: new Date().toISOString(),
      warning: 'All cache data has been deleted'
    })
  } catch (error) {
    console.error('❌ 全キャッシュクリアエラー:', error)
    
    return NextResponse.json({
      status: 'error',
      action: 'full_flush',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}