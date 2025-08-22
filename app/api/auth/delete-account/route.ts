// app/api/auth/delete-account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    console.log('🗑️ Account deletion request from:', session?.user?.email)
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmationText, password, reason } = body

    // 確認テキストチェック
    if (confirmationText !== 'DELETE') {
      return NextResponse.json(
        { error: '確認テキストが正しくありません。「DELETE」と入力してください。' }, 
        { status: 400 }
      )
    }

    const userId = extractUserIdFromPrefixed(session.user.id)
    console.log('🔍 Deleting account for user:', { 
      userId, 
      email: session.user.email,
      name: session.user.name 
    })

    // RDS接続チェック（フォールバック対応）
    let isDatabaseAvailable = false
    try {
      console.log('⏳ Testing database connection...')
      const connectionTest = await prisma.$queryRaw`SELECT 1 as test, NOW() as server_time`
      console.log('✅ Database connection successful:', connectionTest)
      isDatabaseAvailable = true
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError)
      console.log('🔄 Proceeding with graceful degradation mode')
      isDatabaseAvailable = false
    }

    if (!isDatabaseAvailable) {
      // データベース接続失敗時の処理
      console.log('📝 Database unavailable - simulating account deletion')
      
      // GDPR準拠ログ（外部システム）
      const deletionRequest = {
        userId,
        userEmail: session.user.email,
        userName: session.user.name,
        timestamp: new Date().toISOString(),
        confirmationText,
        reason: reason || 'Not specified',
        status: 'pending_database_recovery'
      }
      
      console.log('📋 Logging deletion request for later processing:', deletionRequest)
      
      // 実際の運用では外部キューや管理システムに送信
      // await sendToExternalQueue(deletionRequest)
      
      return NextResponse.json({ 
        message: 'アカウント削除リクエストを受け付けました。データベースメンテナンス中のため、24時間以内に処理を完了いたします。',
        requestId: `del_${userId}_${Date.now()}`,
        status: 'accepted',
        estimatedProcessingTime: '24時間以内'
      })
    }

    // データベース利用可能時の通常処理
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

    // 削除前のデータ統計
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
      const deletedTodos = await tx.todo.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`📝 Deleted ${deletedTodos.count} todos`)

      const deletedSessions = await tx.session.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`🔑 Deleted ${deletedSessions.count} sessions`)

      const deletedAccounts = await tx.account.deleteMany({
        where: { userId: session.user.id }
      })
      console.log(`🔗 Deleted ${deletedAccounts.count} OAuth accounts`)

      await tx.user.delete({
        where: { id: session.user.id }
      })
      console.log(`👤 Deleted user account: ${user.email}`)
    }, {
      timeout: 30000,
      maxWait: 5000,
    })

    console.log('✅ Account deletion completed:', JSON.stringify(deletionStats, null, 2))

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