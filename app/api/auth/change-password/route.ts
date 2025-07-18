import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'

export async function PUT(request: NextRequest) {
  console.log('パスワード変更リクエストを受信しました')
  console.log('環境情報:', {
    nodeEnv: process.env.NODE_ENV,
    nextauthUrl: process.env.NEXTAUTH_URL,
    hasSecret: !!process.env.NEXTAUTH_SECRET,
    databaseUrl: process.env.DATABASE_URL ? 'configured' : 'missing'
  })
  
  try {
    const session = await getAuthSession()
    console.log('セッション情報:', {
      hasSession: !!session,
      hasUserId: !!session?.user?.id,
      email: session?.user?.email,
      hasPassword: session?.user?.hasPassword
    })
    
    if (!isAuthenticated(session)) {
      console.error('認証されていないリクエスト')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OAuth認証ユーザーまたはパスワード認証でないユーザーの場合は拒否
    if (!session.user.hasPassword) {
      console.log('パスワード認証でないユーザーからのリクエスト:', session.user.email)
      return NextResponse.json(
        { error: 'OAuth認証ユーザーはパスワード変更できません' }, 
        { status: 400 }
      )
    }

    // レート制限（1時間に5回まで）
    console.log('レート制限チェック中:', session.user.id)
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `change_password:${session.user.id}`, 
      3600, 
      5
    )
    
    console.log('レート制限結果:', rateLimitResult)
    
    if (!rateLimitResult.allowed) {
      console.warn('レート制限に達しました:', session.user.id)
      return NextResponse.json(
        { error: 'パスワード変更の試行回数が上限に達しました。1時間後に再試行してください。' },
        { status: 429 }
      )
    }

    const body = await request.json()
    console.log('リクエストボディを受信:', { 
      email: session.user.email,
      bodyKeys: Object.keys(body),
      hasCurrentPassword: !!body.currentPassword,
      hasNewPassword: !!body.newPassword,
      currentPasswordLength: body.currentPassword?.length,
      newPasswordLength: body.newPassword?.length
    })
    const { currentPassword, newPassword } = body

    // バリデーション
    console.log('リクエストパラメータ検証:', {
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword,
      currentPasswordType: typeof currentPassword,
      newPasswordType: typeof newPassword
    })
    
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
    const requirements = {
      length: newPassword.length >= 8,
      lowercase: /[a-z]/.test(newPassword),
      uppercase: /[A-Z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[@$!%*?&]/.test(newPassword)
    }
    console.log('パスワード強度検証:', requirements)

    const failedRequirements = []
    if (!requirements.length) failedRequirements.push('8文字以上')
    if (!requirements.lowercase) failedRequirements.push('小文字')
    if (!requirements.uppercase) failedRequirements.push('大文字')
    if (!requirements.number) failedRequirements.push('数字')
    if (!requirements.special) failedRequirements.push('特殊文字(@$!%*?&のいずれか)')

    // 最低3つの要件を満たす必要がある
    const fulfilledCount = Object.values(requirements).filter(Boolean).length
    if (fulfilledCount < 3) {
      return NextResponse.json(
        {
          error: `パスワードが弱すぎます。以下の要件のうち最低3つを満たしてください: ${failedRequirements.join(', ')}`,
          failedRequirements,
          score: fulfilledCount
        },
        { status: 400 }
      )
    }

    // ユーザー情報取得
    console.log('データベースからユーザー情報を取得中...')
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, password: true }
    })

    console.log('ユーザー情報取得結果:', {
      hasUser: !!user,
      hasPassword: !!user?.password,
      email: user?.email
    })

    if (!user) {
      console.error('ユーザーが見つかりませんでした:', session.user.id)
      return NextResponse.json(
        { error: 'ユーザーが見つかりません' }, 
        { status: 404 }
      )
    }

    if (!user.password) {
      console.log('パスワードが設定されていないユーザー:', user.email)
      return NextResponse.json(
        { error: 'パスワード認証を使用していないアカウントです' }, 
        { status: 400 }
      )
    }

    // 現在のパスワード確認
    console.log('ユーザー情報取得:', {
      hasUser: !!user,
      hasPassword: !!user?.password,
      email: user?.email
    })
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    console.log('現在のパスワード検証結果:', { isValid: isCurrentPasswordValid, email: user.email })
    
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: '現在のパスワードが正しくありません' }, 
        { status: 400 }
      )
    }

    // 新しいパスワードが現在のパスワードと同じでないことを確認
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    console.log('新旧パスワード比較:', { isSamePassword })
    if (isSamePassword) {
      return NextResponse.json(
        { error: '新しいパスワードは現在のパスワードと異なる必要があります' }, 
        { status: 400 }
      )
    }

    // 新しいパスワードをハッシュ化
    const hashedNewPassword = await bcrypt.hash(newPassword, 12)

    // パスワード更新
    console.log('パスワード更新を開始:', { email: user.email })
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
    console.error('パスワード変更エラー:', error)
    console.error('エラー詳細:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { error: 'パスワード変更に失敗しました' }, 
      { status: 500 }
    )
  }
}