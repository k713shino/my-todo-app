// app/api/auth/delete-account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
// import { CacheManager, RateLimiter } from '@/lib/cache'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export async function DELETE(request: NextRequest) {
  await optimizeForLambda()
  
  return measureLambdaPerformance('DELETE /api/auth/delete-account', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // レート制限は一旦コメントアウト（cache.tsファイルが存在しないため）
      /*
      const rateLimitResult = await RateLimiter.checkRateLimit(
        `delete_account:${session.user.id}`, 
        86400, // 24時間
        3
      )
      
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'アカウント削除の試行回数が上限に達しました。24時間後に再試行してください。' },
          { status: 429 }
        )
      }
      */

    const body = await request.json()
    const { confirmationText, password, reason } = body

    // 確認テキストチェック
    if (confirmationText !== 'DELETE') {
      return NextResponse.json(
        { error: '確認テキストが正しくありません。「DELETE」と入力してください。' }, 
        { status: 400 }
      )
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        todos: true,
        accounts: true,
        sessions: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' }, 
        { status: 404 }
      )
    }

    // パスワード認証のユーザーの場合のみパスワード確認
    if (user.password && session.user.hasPassword) {
      if (!password) {
        return NextResponse.json(
          { error: 'パスワードが必要です' }, 
          { status: 400 }
        )
      }

      const isPasswordValid = await bcrypt.compare(password, user.password)
      if (!isPasswordValid) {
        return NextResponse.json(
          { error: 'パスワードが正しくありません' }, 
          { status: 400 }
        )
      }
    }

    // 削除前のデータ統計（ログ用）
    const deletionStats = {
      userId: user.id,
      email: user.email,
      todoCount: user.todos.length,
      accountCount: user.accounts.length,
      sessionCount: user.sessions.length,
      authMethod: user.password ? 'credentials' : 'oauth',
      createdAt: user.createdAt,
      deletedAt: new Date().toISOString(),
      reason: reason || 'Not specified'
    }

    console.log('🗑️ Account deletion initiated:', {
      userId: user.id,
      email: user.email,
      authMethod: deletionStats.authMethod,
      dataCount: {
        todos: deletionStats.todoCount,
        sessions: deletionStats.sessionCount,
        accounts: deletionStats.accountCount
      }
    })

    // トランザクションでデータ削除
    await prisma.$transaction(async (tx) => {
      // 1. Todoの削除（カスケード削除されるが明示的に）
      const deletedTodos = await tx.todo.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`📝 Deleted ${deletedTodos.count} todos`)

      // 2. セッションの削除
      const deletedSessions = await tx.session.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`🔑 Deleted ${deletedSessions.count} sessions`)

      // 3. OAuth アカウントの削除
      const deletedAccounts = await tx.account.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`🔗 Deleted ${deletedAccounts.count} OAuth accounts`)

      // 4. ユーザーアカウントの削除
      await tx.user.delete({
        where: { id: session.user.id }
      })
      console.log(`👤 Deleted user account: ${user.email}`)
    })

    // Redisからユーザー関連データを削除（一旦コメントアウト）
    /*
    try {
      const deletedCacheKeys = await CacheManager.deletePattern(`*${session.user.id}*`)
      console.log(`🧹 Deleted ${deletedCacheKeys} cache keys`)
    } catch (error) {
      console.warn('Redis cleanup failed (non-critical):', error)
    }
    */

    // 削除ログ記録（監査用）
    console.log('✅ Account deletion completed:', JSON.stringify(deletionStats, null, 2))

    // GDPR準拠のログ（外部webhook送信）
    if (process.env.GDPR_AUDIT_WEBHOOK) {
      try {
        await fetch(process.env.GDPR_AUDIT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'account_deletion',
            timestamp: deletionStats.deletedAt,
            ...deletionStats
          })
        })
        console.log('📋 GDPR audit log sent')
      } catch (error) {
        console.error('GDPR audit log failed:', error)
      }
    }

    return NextResponse.json({ 
      message: 'アカウントが正常に削除されました',
      deletedAt: deletionStats.deletedAt,
      stats: {
        todoCount: deletionStats.todoCount,
        authMethod: deletionStats.authMethod,
        memberSince: deletionStats.createdAt
      }
    })

    } catch (error) {
      console.error('❌ Account deletion error:', error)
      return NextResponse.json(
        { error: 'アカウント削除に失敗しました。しばらく後に再試行してください。' }, 
        { status: 500 }
      )
    }
  })
}

// OPTIONS メソッドの追加（CORS対応）
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}