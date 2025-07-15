import Redis from 'ioredis'

// Redis接続設定を取得する関数
const getRedisConfig = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379'
}

// ビルド時の接続問題を回避する関数です
const shouldConnectRedis = (): boolean => {
  // ビルド時やテスト時は接続しない
  if (process.env.NODE_ENV === 'test') return false
  if (process.env.NEXT_PHASE === 'phase-production-build') return false
  if (process.env.CI === 'true') return false
  
  // Vercelビルド環境での判定
  if (process.env.VERCEL === '1' && !process.env.REDIS_URL?.includes('upstash')) {
    return false
  }
  
  return true
}

// Redisクライアントのシングルトンインスタンス
class RedisClient {
  private static instance: Redis | null = null
  private static pubClient: Redis | null = null
  private static subClient: Redis | null = null
  private static isDisabled = false

  // メインのRedisクライアントを取得
  static getInstance(): Redis {
    // 接続が無効化されている場合はモックを返します
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.instance) {
      try {
        const redisUrl = getRedisConfig()
        
        // 最もシンプルな設定
        this.instance = new Redis(redisUrl)

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
          if (err.message.includes('ECONNREFUSED')) {
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

  // モックRedisクライアント
  private static createMockRedis(): Redis {
    const mockRedis = {
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
      ping: async (): Promise<string> => 'PONG',
      
      // 情報取得
      info: async (): Promise<string> => 
        'redis_version:7.0.0\r\nused_memory:1000000\r\nconnected_clients:1\r\nkeyspace_hits:0\r\nkeyspace_misses:0\r\ntotal_commands_processed:0\r\n',
      
      // ハッシュ操作
      hset: async (): Promise<number> => 1,
      hget: async (): Promise<string | null> => null,
      hgetall: async (): Promise<Record<string, string>> => ({}),
      hdel: async (): Promise<number> => 1,
      
      // ソート済みセット
      zadd: async (): Promise<number> => 1,
      
      // リスト操作
      lpush: async (): Promise<number> => 1,
      lrange: async (): Promise<string[]> => [],
      ltrim: async (): Promise<string> => 'OK',
      
      // Pub/Sub
      publish: async (): Promise<number> => 0,
      subscribe: async (): Promise<void> => {},
      unsubscribe: async (): Promise<void> => {},
      psubscribe: async (): Promise<void> => {},
      punsubscribe: async (): Promise<void> => {},
      
      // イベント管理
      on: (): void => {},
      off: (): void => {},
      
      // 接続管理
      quit: async (): Promise<string> => 'OK',
      disconnect: async (): Promise<void> => {},
      
      // データベース管理
      flushdb: async (): Promise<string> => 'OK',
    } as any

    console.log('Using graceful mock Redis client')
    return mockRedis
  }

  // メッセージ送信用クライアント
  static getPubClient(): Redis {
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.pubClient) {
      try {
        const redisUrl = getRedisConfig()
        // 最もシンプルな設定
        this.pubClient = new Redis(redisUrl)
      } catch (error) {
        console.error('Pub client creation error:', error)
        return this.createMockRedis()
      }
    }
    return this.pubClient
  }

  // メッセージ受信用クライアント
  static getSubClient(): Redis {
    if (this.isDisabled || !shouldConnectRedis()) {
      return this.createMockRedis()
    }

    if (!this.subClient) {
      try {
        const redisUrl = getRedisConfig()
        // 最もシンプルな設定
        this.subClient = new Redis(redisUrl)
      } catch (error) {
        console.error('Sub client creation error:', error)
        return this.createMockRedis()
      }
    }
    return this.subClient
  }

  // 全ての接続を閉じる
  static async disconnect(): Promise<void> {
    if (this.isDisabled) return

    const disconnectPromises: Promise<void>[] = []

    if (this.instance) {
      disconnectPromises.push(
        this.instance.quit().then(() => {
          this.instance = null
        }).catch(() => {
          this.instance = null
        })
      )
    }

    if (this.pubClient) {
      disconnectPromises.push(
        this.pubClient.quit().then(() => {
          this.pubClient = null
        }).catch(() => {
          this.pubClient = null
        })
      )
    }

    if (this.subClient) {
      disconnectPromises.push(
        this.subClient.quit().then(() => {
          this.subClient = null
        }).catch(() => {
          this.subClient = null
        })
      )
    }

    await Promise.allSettled(disconnectPromises)
  }

  // 接続状態チェック
  static async isConnected(): Promise<boolean> {
    if (this.isDisabled || !shouldConnectRedis()) return false
    
    try {
      if (!this.instance) return false
      const result = await this.instance.ping()
      return result === 'PONG'
    } catch (_error) {
      return false
    }
  }

  // 強制的にモックモードに切り替え（開発用）
  static forceDisable(): void {
    this.isDisabled = true
    console.log('Redis manually disabled - using mock client')
  }

  // モックモードを解除（開発用）
  static forceEnable(): void {
    this.isDisabled = false
    console.log('Redis manually enabled - attempting real connection')
  }
}

// プロセス終了時のクリーンアップ
const cleanup = async (): Promise<void> => {
  console.log('🧹 Cleaning up Redis connections gracefully...')
  try {
    await RedisClient.disconnect()
  } catch (err) {
    // エラーでも処理
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