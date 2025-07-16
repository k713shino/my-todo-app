import { redis } from './redis'
import { CacheManager } from './cache'

export class MonitoringService {
  // Redis監視メトリクス収集
  static async collectRedisMetrics(): Promise<{
    memory: number
    keys: number
    connections: number
    operations: number
    hitRate: number
  }> {
    try {
      const info = await redis.info()
      const keyspace = await redis.info('keyspace')
      const stats = await redis.info('stats')
      
      // メモリ使用量（バイト）
      const memoryMatch = info.match(/used_memory:(\d+)/)
      const memory = memoryMatch ? parseInt(memoryMatch[1]) : 0
      
      // キー総数
      const keysMatch = keyspace.match(/keys=(\d+)/)
      const keys = keysMatch ? parseInt(keysMatch[1]) : 0
      
      // 接続数
      const connectionsMatch = info.match(/connected_clients:(\d+)/)
      const connections = connectionsMatch ? parseInt(connectionsMatch[1]) : 0
      
      // 操作数
      const opsMatch = stats.match(/total_commands_processed:(\d+)/)
      const operations = opsMatch ? parseInt(opsMatch[1]) : 0
      
      // ヒット率計算
      const hitsMatch = stats.match(/keyspace_hits:(\d+)/)
      const missesMatch = stats.match(/keyspace_misses:(\d+)/)
      const hits = hitsMatch ? parseInt(hitsMatch[1]) : 0
      const misses = missesMatch ? parseInt(missesMatch[1]) : 0
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0
      
      return { memory, keys, connections, operations, hitRate }
    } catch (error) {
      console.error('Redis metrics collection error:', error)
      return { memory: 0, keys: 0, connections: 0, operations: 0, hitRate: 0 }
    }
  }

  // アプリケーション健全性チェック
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, { 
      status: string; 
      latency?: number; 
      error?: string;
      heapUsed?: number;
      heapTotal?: number;
    }>
  }> {
    const checks: Record<string, { 
      status: string; 
      latency?: number; 
      error?: string;
      heapUsed?: number;
      heapTotal?: number;
    }> = {}
    
    // Redis接続チェック
    try {
      const redisHealth = await CacheManager.healthCheck()
      checks.redis = redisHealth
    } catch (error) {
      checks.redis = { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' }
    }
    
    // メモリ使用量チェック
    const memoryUsage = process.memoryUsage()
    checks.memory = {
      status: memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'degraded',
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal
    }
    
    // 全体の健全性判定
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy')
    const anyUnhealthy = Object.values(checks).some(check => check.status === 'unhealthy')
    
    const overallStatus = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded'
    
    return { status: overallStatus, checks }
  }

  static async trackPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): Promise<void> {
    try {
      const key = `performance:${operation}`
      const data = {
        duration,
        timestamp: Date.now(),
        ...metadata
      }
      
      await redis.zadd(key, Date.now(), JSON.stringify(data))
      await redis.expire(key, 86400)
      
    } catch (error) {
      console.error('Performance tracking error:', error)
    }
  }
}

export default MonitoringService