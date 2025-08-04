import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { CacheManager } from '@/lib/cache'
import { redis } from '@/lib/redis'
import { Priority } from '@prisma/client'

/**
 * GET: キャッシュ状態のデバッグ情報取得API
 * 
 * 機能:
 * - Redis接続状態の確認
 * - キャッシュヒット率の確認
 * - メモリ使用量の確認
 * - ユーザー固有のキャッシュ状態確認
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // アクション別の処理
    switch (action) {
      case 'health':
        const health = await CacheManager.healthCheck()
        return NextResponse.json({
          redis: health,
          timestamp: Date.now()
        })

      case 'usage':
        const usage = await CacheManager.checkUsage()
        return NextResponse.json({
          usage,
          timestamp: Date.now()
        })

      case 'user-cache':
        const userTodos = await CacheManager.getTodos(session.user.id)
        return NextResponse.json({
          userId: session.user.id,
          hasCachedTodos: !!userTodos,
          todoCount: userTodos?.length || 0,
          timestamp: Date.now()
        })

      case 'invalidate':
        const invalidated = await CacheManager.invalidateUserTodos(session.user.id)
        return NextResponse.json({
          invalidated,
          userId: session.user.id,
          timestamp: Date.now()
        })

      case 'cleanup':
        const cleaned = await CacheManager.cleanupOldKeys()
        return NextResponse.json({
          cleanedKeys: cleaned,
          timestamp: Date.now()
        })

      default:
        // 総合的なデバッグ情報
        const [healthStatus, usageStatus, userCache] = await Promise.allSettled([
          CacheManager.healthCheck(),
          CacheManager.checkUsage(),
          CacheManager.getTodos(session.user.id)
        ])

        return NextResponse.json({
          health: healthStatus.status === 'fulfilled' ? healthStatus.value : null,
          usage: usageStatus.status === 'fulfilled' ? usageStatus.value : null,
          userCache: {
            userId: session.user.id,
            hasCachedTodos: userCache.status === 'fulfilled' && !!userCache.value,
            todoCount: userCache.status === 'fulfilled' ? userCache.value?.length || 0 : 0
          },
          timestamp: Date.now()
        })
    }
  } catch (error) {
    console.error('Cache debug error:', error)
    return NextResponse.json({ 
      error: 'Cache debug failed',
      timestamp: Date.now()
    }, { status: 500 })
  }
}

/**
 * POST: キャッシュ操作API
 * 
 * 機能:
 * - キャッシュの強制無効化
 * - パフォーマンステスト用のデータ生成
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'force-invalidate':
        await CacheManager.invalidateUserTodos(session.user.id)
        return NextResponse.json({
          message: 'Cache forcefully invalidated',
          userId: session.user.id,
          timestamp: Date.now()
        })

      case 'warm-cache':
        // テスト用のキャッシュウォーミング
        const mockTodos = Array(10).fill(null).map((_, i) => ({
          id: `test-${i}`,
          title: `Test Todo ${i}`,
          completed: i % 2 === 0,
          priority: 'MEDIUM' as Priority,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: session.user.id,
          description: null
        }))
        
        await CacheManager.setTodos(session.user.id, mockTodos)
        return NextResponse.json({
          message: 'Cache warmed with test data',
          todoCount: mockTodos.length,
          timestamp: Date.now()
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Cache operation error:', error)
    return NextResponse.json({ 
      error: 'Cache operation failed',
      timestamp: Date.now()
    }, { status: 500 })
  }
}