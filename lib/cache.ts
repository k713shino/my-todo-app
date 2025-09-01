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

// キャッシュ管理クラス（Upstash Redis最適化版）
export class CacheManager {
  private static DEFAULT_TTL = 1800 // 30分（Upstash無料枠に最適）
  private static MAX_KEYS_PER_USER = 50 // ユーザーあたりの最大キー数

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

  // データを保存する（圧縮対応）
  static async set(key: string, value: unknown, ttl = this.DEFAULT_TTL): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value)
      
      // Upstash無料枠（50MB）に配慮した容量チェック
      if (serialized.length > 100000) { // 100KB以上は警告
        console.warn(`Large cache data for key ${key}: ${serialized.length} bytes`)
      }
      
      // タイムアウト付きでRedis操作
      await Promise.race([
        redis.setex(key, ttl, serialized),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis setex timeout')), 2000)
        )
      ])
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

  // Todo関連のキャッシュ操作（最適化版）

  // Todoリストを取得
  static async getTodos(userId: string): Promise<Todo[] | null> {
    return this.get<Todo[]>(CacheKeys.userTodos(userId))
  }

  // Todoリストを保存（最適化版）
  static async setTodos(userId: string, todos: Todo[], ttl = 300): Promise<boolean> { // 5分
    // 大きなデータは要約してキャッシュしつつ、UIに必要なフィールドは保持
    const optimizedTodos = todos.map((todo: any) => ({
      id: todo.id,
      title: todo.title,
      status: todo.status,
      priority: todo.priority,
      dueDate: todo.dueDate,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
      userId: todo.userId,
      category: todo.category ?? null,
      tags: Array.isArray(todo.tags) ? todo.tags : (typeof todo.tags === 'string' ? todo.tags.split(',').map((t: string)=>t.trim()).filter(Boolean) : []),
      parentId: todo.parentId ?? null,
      _count: todo._count && typeof todo._count.subtasks === 'number' ? { subtasks: todo._count.subtasks } : { subtasks: 0 },
      // 説明文は長い場合は省略
      description: todo.description && typeof todo.description === 'string' && todo.description.length > 200 
        ? todo.description.slice(0, 200) + '...'
        : (todo.description ?? null),
    }))
    return this.set(CacheKeys.userTodos(userId), optimizedTodos, ttl)
  }

  // ユーザーのTodo関連キャッシュを全て削除（最適化版）
  static async invalidateUserTodos(userId: string): Promise<boolean> {
    try {
      const keys = [
        CacheKeys.userTodos(userId),
        CacheKeys.userStats(userId),
      ]
      
      // パイプライン処理で高速削除
      const pipeline = redis.pipeline()
      keys.forEach(key => pipeline.del(key))
      await pipeline.exec()
      
      console.log(`🚀 Cache invalidated for user ${userId}: ${keys.length} keys`)
      return true
    } catch (error) {
      console.error('Cache invalidation error:', error)
      return false
    }
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

  // ユーザーアクティビティ追跡
  static async updateUserActivity(userId: string): Promise<boolean> {
    try {
      const key = CacheKeys.userActivity(userId)
      const timestamp = Date.now().toString()
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

  // Upstash Redis使用量監視
  static async checkUsage(): Promise<{ usedMB: number; limit: number; percentage: number }> {
    try {
      const info = await redis.info('memory')
      const memMatch = info.match(/used_memory:(\d+)/)
      const usedBytes = memMatch ? parseInt(memMatch[1]) : 0
      const usedMB = Math.round(usedBytes / 1024 / 1024)
      
      // 50MB制限の80%を超えたら警告
      if (usedMB > 40) {
        console.warn(`⚠️ Redis usage: ${usedMB}MB / 50MB (${Math.round(usedMB/50*100)}%)`)
        
        // 古いキーを削除
        await this.cleanupOldKeys()
      }
      
      return { usedMB, limit: 50, percentage: Math.round(usedMB/50*100) }
    } catch (error) {
      console.error('Usage check error:', error)
      return { usedMB: 0, limit: 50, percentage: 0 }
    }
  }

  // 古いキーのクリーンアップ
  static async cleanupOldKeys(): Promise<number> {
    try {
      const patterns = ['todos:*', 'stats:*', 'search:*']
      let deletedCount = 0
      
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern)
        // 古いキーから削除（LRU的な動作）
        const keysToDelete = keys.slice(0, Math.floor(keys.length / 3))
        
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete)
          deletedCount += keysToDelete.length
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} old cache keys`)
      return deletedCount
    } catch (error) {
      console.error('Cleanup error:', error)
      return 0
    }
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

// レート制限専用クラス（Upstash最適化）
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
