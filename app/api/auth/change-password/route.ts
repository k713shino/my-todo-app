import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1時間に5回まで）
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `change_password:${session.user.id}`, 
      3600, 
      5
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'パスワード変更の試行回数が上限に達しました。1時間後に再試行してください。' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = body

    // バリデーション
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: '現在のパスワードと新しいパスワードの両方が必要です' }, 
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: '新しいパスワードは8文字以上である必要があります' }, 
        { status: 400 }
      )
    }

    // パスワード強度チェック
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        { error: 'パスワードには大文字、小文字、数字、特殊文字を含める必要があります' }, 
        { status: 400 }
      )
    }

    // ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, password: true }
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'パスワード認証を使用していないアカウントです' }, 
        { status: 400 }
      )
    }

    // 現在のパスワード確認
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: '現在のパスワードが正しくありません' }, 
        { status: 400 }
      )
    }

    // 新しいパスワードが現在のパスワードと同じでないことを確認
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json(
        { error: '新しいパスワードは現在のパスワードと異なる必要があります' }, 
        { status: 400 }
      )
    }

    // 新しいパスワードをハッシュ化
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // パスワード更新
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    })

    // セキュリティログ記録（オプション）
    console.log(`Password changed for user: ${user.email} at ${new Date().toISOString()}`)

    return NextResponse.json({ 
      message: 'パスワードが正常に変更されました',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'パスワード変更に失敗しました' }, 
      { status: 500 }
    )
  }
}