import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { CacheManager, RateLimiter } from '@/lib/cache'
import { signOut } from 'next-auth/react'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1日に3回まで）
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

    // パスワード認証のユーザーの場合、パスワード確認
    if (user.password && !password) {
      return NextResponse.json(
        { error: 'パスワードが必要です' }, 
        { status: 400 }
      )
    }

    if (user.password && password) {
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
      createdAt: user.createdAt,
      deletedAt: new Date().toISOString(),
      reason: reason || 'Not specified'
    }

    // トランザクションでデータ削除
    await prisma.$transaction(async (tx) => {
      // 1. Todoの削除（カスケード削除）
      await tx.todo.deleteMany({
        where: { userId: session.user.id }
      })

      // 2. セッションの削除
      await tx.session.deleteMany({
        where: { userId: session.user.id }
      })

      // 3. OAuth アカウントの削除
      await tx.account.deleteMany({
        where: { userId: session.user.id }
      })

      // 4. ユーザーアカウントの削除
      await tx.user.delete({
        where: { id: session.user.id }
      })
    })

    // Redisからユーザー関連データを削除
    try {
      await CacheManager.deletePattern(`*:${session.user.id}`)
      await CacheManager.deletePattern(`*${session.user.id}*`)
    } catch (error) {
      console.warn('Redis cleanup failed:', error)
    }

    // 削除ログ記録（監査用）
    console.log('Account deleted:', JSON.stringify(deletionStats, null, 2))

    // GDPR準拠のログ（必要に応じて外部システムに送信）
    if (process.env.GDPR_AUDIT_WEBHOOK) {
      try {
        await fetch(process.env.GDPR_AUDIT_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'account_deletion',
            ...deletionStats
          })
        })
      } catch (error) {
        console.error('GDPR audit log failed:', error)
      }
    }

    return NextResponse.json({ 
      message: 'アカウントが正常に削除されました',
      deletedAt: deletionStats.deletedAt,
      stats: {
        todoCount: deletionStats.todoCount,
        memberSince: deletionStats.createdAt
      }
    })

  } catch (error) {
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'アカウント削除に失敗しました' }, 
      { status: 500 }
    )
  }
}