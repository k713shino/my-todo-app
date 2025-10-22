import Redis from 'ioredis'

// Upstash Redis用の最適化設定
const getRedisConfig = () => {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required')
  }
  
  // ioredis用の正しい設定オプション
  const maxRetries = process.env.REDIS_MAX_RETRIES_PER_REQUEST
    ? Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST)
    : 20  // デフォルトを20に増加

  console.log(`🔧 Redis config: maxRetriesPerRequest=${maxRetries}`)

  return {
    // 基本設定
    lazyConnect: false,  // すぐに接続を確立
    // リクエストリトライを大幅に増やして接続の不安定さを吸収
    maxRetriesPerRequest: maxRetries,
    retryDelayOnFailover: 100,
    enableReadyCheck: true,  // 接続確認を有効化
    // 再接続戦略（指数バックオフ、最大2s）
    retryStrategy(times: number) {
      if (times > 15) {
        console.error(`❌ Redis connection failed after ${times} attempts`)
        return null  // 15回以上失敗したら諦める
      }
      const delay = Math.min(times * 300, 2000)
      console.log(`🔄 Redis retry attempt ${times}, waiting ${delay}ms`)
      return delay
    },

    // タイムアウト設定（Vercel serverless最適化）
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 15000),
    commandTimeout: Number(process.env.REDIS_COMMAND_TIMEOUT_MS || 15000),

    // TLS設定（Upstashは必須）
    tls: {},

    // 接続プール設定
    family: 4, // IPv4優先（Vercel推奨）
    keepAlive: 10000,
  }
}

// ビルド時の接続問題を回避する関数です
const shouldConnectRedis = (): boolean => {
  // ビルド時やテスト時は接続しない
  if (process.env.NODE_ENV === 'test') return false
  if (process.env.NEXT_PHASE === 'phase-production-build') return false
  if (process.env.CI === 'true') return false
  
  // REDIS_URLが設定されていない場合はモックを使用
  if (!process.env.REDIS_URL) {
    console.log('⚠️ REDIS_URL not set, using mock Redis')
    return false
  }
  
  // Vercelビルド環境での判定（より緩和）
  if (process.env.VERCEL === '1' && process.env.REDIS_URL?.includes('upstash.io')) {
    console.log('✅ Vercel production environment detected with Upstash Redis')
    return true
  }
  
  return true
}

// モックRedisの型定義
interface MockRedis {
  // 基本操作
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string>
  setex(key: string, seconds: number, value: string | number): Promise<string>
  del(...keys: string[]): Promise<number>
  exists(...keys: string[]): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  keys(pattern: string): Promise<string[]>
  incr(key: string): Promise<number>
  incrby(key: string, increment: number): Promise<number>
  ping(): Promise<string>
  
  // 情報取得
  info(section?: string): Promise<string>
  dbsize(): Promise<number>
  
  // ハッシュ操作
  hset(key: string, field: string, value: string): Promise<number>
  hget(key: string, field: string): Promise<string | null>
  hgetall(key: string): Promise<Record<string, string>>
  hdel(key: string, ...fields: string[]): Promise<number>
  
  // ソート済みセット
  zadd(key: string, score: number, member: string): Promise<number>
  zrange(key: string, start: number, stop: number): Promise<string[]>
  zrem(key: string, ...members: string[]): Promise<number>
  
  // リスト操作
  lpush(key: string, ...values: string[]): Promise<number>
  rpush(key: string, ...values: string[]): Promise<number>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  ltrim(key: string, start: number, stop: number): Promise<string>
  
  // セット操作
  sadd(key: string, ...members: string[]): Promise<number>
  smembers(key: string): Promise<string[]>
  srem(key: string, ...members: string[]): Promise<number>
  
  // Pub/Sub操作
  publish(channel: string, message: string): Promise<number>
  subscribe(channel: string): Promise<void>
  unsubscribe(channel?: string): Promise<void>
  psubscribe(pattern: string): Promise<void>
  punsubscribe(pattern?: string): Promise<void>
  
  // データベース操作
  flushdb(): Promise<string>
  flushall(): Promise<string>
  
  // イベントエミッター
  on(event: string, listener: (...args: unknown[]) => void): MockRedis
  off(event: string, listener: (...args: unknown[]) => void): MockRedis
  once(event: string, listener: (...args: unknown[]) => void): MockRedis
  emit(event: string, ...args: unknown[]): boolean
  removeListener(event: string, listener: (...args: unknown[]) => void): MockRedis
  removeAllListeners(event?: string): MockRedis
  
  // 接続管理
  connect(): Promise<void>
  disconnect(): Promise<void>
  quit(): Promise<string>
  
  // ステータス
  status: string
  
  // Pipeline処理
  pipeline(): unknown
  multi(): unknown

  // その他
  options: Record<string, unknown>
  condition: Record<string, unknown>
}

// Redisクライアントのシングルトンインスタンス
class RedisClient {
  private static instance: Redis | MockRedis | null = null
  private static pubClient: Redis | MockRedis | null = null
  private static subClient: Redis | MockRedis | null = null
  private static isDisabled = false

  // メインのRedisクライアントを取得
  static getInstance(): Redis | MockRedis {
    // 接続が無効化されている場合はモックを返します
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.instance) {
      try {
        const redisUrl = process.env.REDIS_URL!
        const options = getRedisConfig()
        
        // 正しいioredis初期化方法
        this.instance = new Redis(redisUrl, options)

        // 接続イベントの監視
        this.instance.on('connect', () => {
          console.log('✅ Redis connected gracefully')
        })

        this.instance.on('ready', () => {
          console.log('✅ Redis ready for service')
        })

        this.instance.on('error', (err: Error) => {
          console.error('❌ Redis error:', err.message)
          // エラーが続く場合は無効化
          if (
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('max retries per request') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('ENOTFOUND')
          ) {
            console.log('Redis gracefully disabled due to connection issues')
            this.isDisabled = true
          }
        })

        this.instance.on('close', () => {
          console.log('❌ Redis connection closed')
        })

        this.instance.on('reconnecting', (delay: number) => {
          console.log(`🔄 Redis reconnecting in ${delay}ms...`)
        })
      } catch (error) {
        console.error('Redis initialization error:', error)
        this.isDisabled = true
        return this.createMockRedis()
      }
    }
    return this.instance
  }

  // メッセージ送信用クライアント
  static getPubClient(): Redis | MockRedis {
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.pubClient) {
      try {
        const redisUrl = process.env.REDIS_URL!
        const options = getRedisConfig()
        this.pubClient = new Redis(redisUrl, options)
        
        this.pubClient.on('error', (err: Error) => {
          console.error('❌ Redis Pub client error:', err.message)
          if (
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('max retries per request') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('ENOTFOUND')
          ) {
            this.isDisabled = true
          }
        })
      } catch (error) {
        console.error('Pub client creation error:', error)
        return this.createMockRedis()
      }
    }
    return this.pubClient
  }

  // メッセージ受信用クライアント
  static getSubClient(): Redis | MockRedis {
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.subClient) {
      try {
        const redisUrl = process.env.REDIS_URL!
        const options = getRedisConfig()
        this.subClient = new Redis(redisUrl, options)
        
        this.subClient.on('error', (err: Error) => {
          console.error('❌ Redis Sub client error:', err.message)
          if (
            err.message.includes('ECONNREFUSED') ||
            err.message.includes('max retries per request') ||
            err.message.includes('ETIMEDOUT') ||
            err.message.includes('ENOTFOUND')
          ) {
            this.isDisabled = true
          }
        })
      } catch (error) {
        console.error('Sub client creation error:', error)
        return this.createMockRedis()
      }
    }
    return this.subClient
  }

  // モックRedisクライアント
  private static createMockRedis(): MockRedis {
    const mockRedis: MockRedis = {
      // 基本的なRedisコマンド
      get: async (): Promise<string | null> => null,
      set: async (): Promise<string> => 'OK',
      setex: async (): Promise<string> => 'OK',
      del: async (): Promise<number> => 1,
      exists: async (): Promise<number> => 0,
      expire: async (): Promise<number> => 1,
      ttl: async (): Promise<number> => -1,
      keys: async (): Promise<string[]> => [],
      incr: async (): Promise<number> => 1,
      incrby: async (): Promise<number> => 1,
      ping: async (): Promise<string> => 'PONG',
      
      // 情報取得
      info: async (): Promise<string> => 
        'redis_version:7.0.0\r\nused_memory:1000000\r\nconnected_clients:1\r\nkeyspace_hits:0\r\nkeyspace_misses:0\r\ntotal_commands_processed:0\r\n',
      dbsize: async (): Promise<number> => 0,
      
      // ハッシュ操作
      hset: async (): Promise<number> => 1,
      hget: async (): Promise<string | null> => null,
      hgetall: async (): Promise<Record<string, string>> => ({}),
      hdel: async (): Promise<number> => 1,
      
      // ソート済みセット
      zadd: async (): Promise<number> => 1,
      zrange: async (): Promise<string[]> => [],
      zrem: async (): Promise<number> => 1,
      
      // リスト操作
      lpush: async (): Promise<number> => 1,
      rpush: async (): Promise<number> => 1,
      lrange: async (): Promise<string[]> => [],
      ltrim: async (): Promise<string> => 'OK',
      
      // セット操作
      sadd: async (): Promise<number> => 1,
      smembers: async (): Promise<string[]> => [],
      srem: async (): Promise<number> => 1,
      
      // Pub/Sub操作
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<void> => {},
      unsubscribe: async (): Promise<void> => {},
      psubscribe: async (): Promise<void> => {},
      punsubscribe: async (): Promise<void> => {},
      
      // データベース操作
      flushdb: async (): Promise<string> => 'OK',
      flushall: async (): Promise<string> => 'OK',
      
      // イベントエミッター
      on: (): MockRedis => mockRedis,
      off: (): MockRedis => mockRedis,
      once: (): MockRedis => mockRedis,
      emit: (): boolean => true,
      removeListener: (): MockRedis => mockRedis,
      removeAllListeners: (): MockRedis => mockRedis,
      
      // 接続管理
      connect: async (): Promise<void> => {},
      disconnect: async (): Promise<void> => {},
      quit: async (): Promise<string> => 'OK',
      
      // ステータス
      status: 'ready',
      
      // Pipeline処理
      pipeline: () => ({
        set: () => mockRedis.pipeline(),
        get: () => mockRedis.pipeline(),
        del: () => mockRedis.pipeline(),
        exec: async (): Promise<Array<[Error | null, unknown]>> => []
      }),
      
      // Transaction処理
      multi: () => ({
        set: () => mockRedis.multi(),
        get: () => mockRedis.multi(),
        del: () => mockRedis.multi(),
        exec: async (): Promise<Array<[Error | null, unknown]> | null> => []
      }),
      
      // その他のプロパティ
      options: {},
      condition: {}
    }

    console.log('🎭 Using graceful mock Redis client')
    return mockRedis
  }

  // 全ての接続を閉じる
  static async disconnect(): Promise<void> {
    if (this.isDisabled) return

    const disconnectPromises: Promise<void>[] = []

    if (this.instance) {
      disconnectPromises.push(
        this.instance.quit().then(() => {
          this.instance = null
        }).catch((_err: unknown) => {
          this.instance = null
        })
      )
    }

    if (this.pubClient) {
      disconnectPromises.push(
        this.pubClient.quit().then(() => {
          this.pubClient = null
        }).catch((_err: unknown) => {
          this.pubClient = null
        })
      )
    }

    if (this.subClient) {
      disconnectPromises.push(
        this.subClient.quit().then(() => {
          this.subClient = null
        }).catch((_err: unknown) => {
          this.subClient = null
        })
      )
    }

    await Promise.allSettled(disconnectPromises)
  }

  // 強制的にモックモードに切り替え（開発用）
  static forceDisable(): void {
    this.isDisabled = true
    console.log('🎭 Redis manually disabled - using mock client')
  }

  // モックモードを解除（開発用）
  static forceEnable(): void {
    this.isDisabled = false
    console.log('🔗 Redis manually enabled - attempting real connection')
  }
}

// プロセス終了時のクリーンアップ
const cleanup = async (): Promise<void> => {
  console.log('🧹 Cleaning up Redis connections gracefully...')
  try {
    await RedisClient.disconnect()
    console.log('✅ Redis cleanup completed')
  } catch (err) {
    console.warn('⚠️ Redis cleanup error (non-critical):', err)
  }
}

// プロセス終了シグナルを処理
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await cleanup()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await cleanup()
    process.exit(0)
  })

  process.on('beforeExit', async () => {
    await cleanup()
  })
}

// エクスポート（他のファイルで使用するため）
export const redis = RedisClient.getInstance()
export const pubClient = RedisClient.getPubClient()
export const subClient = RedisClient.getSubClient()
export { RedisClient }
export default redis
