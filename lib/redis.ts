import Redis from 'ioredis'

// Redis接続設定を取得する関数
const getRedisUrl = (): string => {
  return process.env.REDIS_URL || 'redis://localhost:6379'
}

// Redisクライアントのシングルトンインスタンス
class RedisClient {
  private static instance: Redis | null = null
  private static pubClient: Redis | null = null
  private static subClient: Redis | null = null

  // メインのRedisクライアントを取得
  static getInstance(): Redis {
    if (!this.instance) {
      const redisUrl = getRedisUrl()
      
      this.instance = new Redis(redisUrl)

      // 接続イベントの監視
      this.instance.on('connect', () => {
        console.log('✅ Redis connected')
      })

      this.instance.on('ready', () => {
        console.log('✅ Redis ready')
      })

      this.instance.on('error', (err: Error) => {
        console.error('❌ Redis error:', err)
      })

      this.instance.on('close', () => {
        console.log('❌ Redis connection closed')
      })

      this.instance.on('reconnecting', (delay: number) => {
        console.log(`🔄 Redis reconnecting in ${delay}ms...`)
      })
    }
    return this.instance
  }

  // メッセージ送信用クライアント
  static getPubClient(): Redis {
    if (!this.pubClient) {
      const redisUrl = getRedisUrl()
      this.pubClient = new Redis(redisUrl)
    }
    return this.pubClient
  }

  // メッセージ受信用クライアント
  static getSubClient(): Redis {
    if (!this.subClient) {
      const redisUrl = getRedisUrl()
      this.subClient = new Redis(redisUrl)
    }
    return this.subClient
  }

  // 全ての接続を閉じる
  static async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = []

    if (this.instance) {
      disconnectPromises.push(
        this.instance.quit().then(() => {
          this.instance = null
        }).catch(err => {
          console.error('Error disconnecting main Redis client:', err)
          this.instance = null
        })
      )
    }

    if (this.pubClient) {
      disconnectPromises.push(
        this.pubClient.quit().then(() => {
          this.pubClient = null
        }).catch(err => {
          console.error('Error disconnecting pub Redis client:', err)
          this.pubClient = null
        })
      )
    }

    if (this.subClient) {
      disconnectPromises.push(
        this.subClient.quit().then(() => {
          this.subClient = null
        }).catch(err => {
          console.error('Error disconnecting sub Redis client:', err)
          this.subClient = null
        })
      )
    }

    await Promise.allSettled(disconnectPromises)
  }

  // 接続状態チェック
  static async isConnected(): Promise<boolean> {
    try {
      if (!this.instance) return false
      const result = await this.instance.ping()
      return result === 'PONG'
    } catch (_error) {
      return false
    }
  }
}

// プロセス終了時のクリーンアップ
const cleanup = async (): Promise<void> => {
  console.log('🧹 Cleaning up Redis connections...')
  try {
    await RedisClient.disconnect()
  } catch (err) {
    console.error('Error during cleanup:', err)
  }
}

process.on('SIGINT', async () => {
  await cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await cleanup()
  process.exit(0)
})

// エクスポート（他のファイルで使用するため）
export const redis = RedisClient.getInstance()
export const pubClient = RedisClient.getPubClient()
export const subClient = RedisClient.getSubClient()
export { RedisClient }
export default redis