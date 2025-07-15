const Redis = require('ioredis')
require('dotenv').config({ path: '.env.local' })

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

async function getCacheStats() {
  try {
    console.log('📊 Redis統計情報を取得中...\n')
    
    // 基本情報
    const info = await redis.info()
    const memory = await redis.info('memory')
    const stats = await redis.info('stats')
    
    // メモリ使用量
    const memoryMatch = memory.match(/used_memory_human:(.+)/)
    const usedMemory = memoryMatch ? memoryMatch[1].trim() : 'unknown'
    
    // キー数
    const totalKeys = await redis.dbsize()
    
    // ヒット率
    const hitsMatch = stats.match(/keyspace_hits:(\d+)/)
    const missesMatch = stats.match(/keyspace_misses:(\d+)/)
    const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0
    const misses = missesMatch ? parseInt(missesMatch[1]) : 0
    const hitRate = hits + misses > 0 ? ((hits / (hits + misses)) * 100).toFixed(2) : '0.00'
    
    console.log('=== Redis 統計情報 ===')
    console.log(`📦 メモリ使用量: ${usedMemory}`)
    console.log(`🔑 総キー数: ${totalKeys}`)
    console.log(`🎯 キャッシュヒット率: ${hitRate}%`)
    console.log(`✅ ヒット数: ${hits}`)
    console.log(`❌ ミス数: ${misses}`)
    
    // キーパターン別統計
    console.log('\n=== キーパターン別統計 ===')
    const patterns = ['todos:*', 'stats:*', 'session:*', 'search:*', 'activity:*']
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern)
      console.log(`${pattern}: ${keys.length}個`)
    }
    
  } catch (error) {
    console.error('❌ 統計取得エラー:', error)
  } finally {
    await redis.quit()
  }
}