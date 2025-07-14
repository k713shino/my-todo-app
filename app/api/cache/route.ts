import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { CacheManager } from '@/lib/cache'
import { redis } from '@/lib/redis'

// キャッシュ統計取得
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const health = await CacheManager.healthCheck()

    // 簡易的なキャッシュ統計
    const userTodosExists = await CacheManager.exists(`todos:user:${session.user.id}`)
    const userStatsExists = await CacheManager.exists(`stats:user:${session.user.id}`)
    const isUserActive = await CacheManager.isUserActive(session.user.id)

    return NextResponse.json({
      health,
      userCache: {
        hasUserTodos: userTodosExists,
        hasUserStats: userStatsExists,
        isUserActive
      }
    })
  } catch (error) {
    console.error('Cache stats error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// キャッシュクリア
export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    let clearedKeys = 0

    switch (type) {
      case 'user':
        // ユーザー関連キャッシュのみクリア
        clearedKeys = await CacheManager.deletePattern(`*user:${session.user.id}*`)
        clearedKeys += await CacheManager.deletePattern(`todos:user:${session.user.id}`)
        clearedKeys += await CacheManager.deletePattern(`stats:user:${session.user.id}`)
        clearedKeys += await CacheManager.deletePattern(`search:${session.user.id}:*`)
        break
        
      case 'search':
        // 検索キャッシュのみクリア
        clearedKeys = await CacheManager.deletePattern(`search:${session.user.id}:*`)
        break
        
      default:
        return NextResponse.json({ error: 'Invalid cache type' }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Cache cleared successfully',
      clearedKeys,
      type
    })
  } catch (error) {
    console.error('Cache clear error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}