import { redis } from './redis'
import { Todo } from '@/types/todo'

// キャッシュキー生成（データを整理するための名前付け）
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userTodos: (userId: string) => `todos:user:${userId}`,
  userStats: (userId: string) => `stats:user:${userId}`,
  todoItem: (todoId: string) => `todo:${todoId}`,
  userSession: (sessionId: string) => `session:${sessionId}`,
  userActivity: (userId: string) => `activity:user:${userId}`,
  apiRateLimit: (identifier: string) => `ratelimit:${identifier}`,
} as const

// セッションデータの型定義
interface SessionData {
  user?: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  timestamp: number
  [key: string]: unknown
}

// キャッシュ管理クラス
export class CacheManager {
  private static DEFAULT_TTL = 3600 // 1時間（秒単位）

  // 基本的なキャッシュ操作

  // データを取得する
  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key)
      return value ? JSON.parse(value) : null
    } catch (_error: unknown) {
      console.error('Cache get error:', _error)
      return null
    }
  }

  // データを保存する
  static async set(key: string, value: unknown, ttl = this.DEFAULT_TTL): Promise<boolean> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
      return true
    } catch (_error: unknown) {
      console.error('Cache set error:', _error)
      return false
    }
  }

  // データを削除する
  static async del(key: string | string[]): Promise<boolean> {
    try {
      if (Array.isArray(key)) {
        await redis.del(...key)
      } else {
        await redis.del(key)
      }
      return true
    } catch (_error: unknown) {
      console.error('Cache delete error:', _error)
      return false
    }
  }

  // データが存在するかチェック
  static async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (_error: unknown) {
      console.error('Cache exists error:', _error)
      return false
    }
  }

  // パターンマッチによる一括削除
  static async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        return await redis.del(...keys)
      }
      return 0
    } catch (_error: unknown) {
      console.error('Cache delete pattern error:', _error)
      return 0
    }
  }

  // Todo関連のキャッシュ操作

  // Todoリストを取得
  static async getTodos(userId: string): Promise<Todo[] | null> {
    return this.get<Todo[]>(CacheKeys.userTodos(userId))
  }

  // Todoリストを保存
  static async setTodos(userId: string, todos: Todo[], ttl = this.DEFAULT_TTL): Promise<boolean> {
    return this.set(CacheKeys.userTodos(userId), todos, ttl)
  }

  // ユーザーのTodo関連キャッシュを全て削除
  static async invalidateUserTodos(userId: string): Promise<boolean> {
    const keys = [
      CacheKeys.userTodos(userId),
      CacheKeys.userStats(userId),
    ]
    return this.del(keys)
  }

  // セッション管理
  static async setSession(sessionId: string, sessionData: SessionData, ttl = 86400): Promise<boolean> {
    return this.set(CacheKeys.userSession(sessionId), sessionData, ttl)
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    return this.get<SessionData>(CacheKeys.userSession(sessionId))
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    return this.del(CacheKeys.userSession(sessionId))
  }

  // ユーザーアクティビティ追跡（型エラー修正）
  static async updateUserActivity(userId: string): Promise<boolean> {
    try {
      const key = CacheKeys.userActivity(userId)
      const timestamp = Date.now().toString() // 文字列に変換
      await redis.setex(key, 1800, timestamp) // 30分間のアクティビティ記録
      return true
    } catch (_error: unknown) {
      console.error('User activity update error:', _error)
      return false
    }
  }

  static async isUserActive(userId: string): Promise<boolean> {
    const activity = await this.get<string>(CacheKeys.userActivity(userId))
    if (!activity) return false
    
    const now = Date.now()
    const lastActivity = parseInt(activity, 10)
    return (now - lastActivity) < 1800000 // 30分以内
  }

  // ヘルスチェック
  static async healthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now()
    try {
      await redis.ping()
      const latency = Date.now() - start
      return { status: 'healthy', latency }
    } catch (_error: unknown) {
      return { status: 'unhealthy', latency: Date.now() - start }
    }
  }
}

// レート制限結果の型定義
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

// レート制限専用クラス
export class RateLimiter {
  static async checkRateLimit(
    identifier: string, 
    windowSize = 3600, // 1時間
    maxRequests = 100
  ): Promise<RateLimitResult> {
    try {
      const key = CacheKeys.apiRateLimit(identifier)
      const current = await redis.incr(key)
      
      if (current === 1) {
        await redis.expire(key, windowSize)
      }
      
      const ttl = await redis.ttl(key)
      const resetTime = Date.now() + (ttl * 1000)
      
      return {
        allowed: current <= maxRequests,
        remaining: Math.max(0, maxRequests - current),
        resetTime
      }
    } catch (_error: unknown) {
      console.error('Rate limit check error:', _error)
      // エラー時は制限を無効化
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: Date.now() + (windowSize * 1000)
      }
    }
  }
}

export default CacheManager