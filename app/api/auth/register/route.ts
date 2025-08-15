import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSecurityHeaders } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 会員登録API開始')
    
    // 環境とライブラリの初期チェック
    console.log('🔍 環境チェック:', {
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      prismaAvailable: !!prisma,
      bcryptAvailable: !!bcrypt
    })
    
    // リクエストボディの取得とログ出力
    let requestData
    try {
      requestData = await request.json()
      console.log('📥 リクエストデータ:', {
        hasName: !!requestData.name,
        hasEmail: !!requestData.email,
        hasPassword: !!requestData.password,
        passwordLength: requestData.password?.length
      })
    } catch (jsonError) {
      console.error('❌ JSON解析エラー:', jsonError)
      return NextResponse.json(
        { error: '不正なリクエスト形式です' },
        { status: 400 }
      )
    }

    const { name, email, password } = requestData
    
    // バリデーション
    console.log('🔍 バリデーション開始')
    if (!email || !password || password.length < 8) {
      console.log('❌ バリデーション失敗: 不十分な入力')
      return NextResponse.json(
        { error: 'メールアドレスと8文字以上のパスワードが必要です' }, 
        { status: 400 }
      )
    }
    
    // メールアドレス形式チェック
    console.log('🔍 メールアドレス形式チェック')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('❌ メールアドレス形式エラー:', email)
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' }, 
        { status: 400 }
      )
    }
    
    // 既存ユーザーチェック
    console.log('🔍 既存ユーザーチェック開始')
    let existingUser
    try {
      existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() }
      })
      console.log('✅ 既存ユーザーチェック完了:', { found: !!existingUser })
    } catch (findError) {
      console.error('❌ 既存ユーザーチェックエラー:', findError)
      throw findError
    }
    
    if (existingUser) {
      console.log('❌ 重複ユーザー発見')
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' }, 
        { status: 400 }
      )
    }
    
    // パスワードハッシュ化
    console.log('🔍 パスワードハッシュ化開始')
    let hashedPassword
    try {
      hashedPassword = await bcrypt.hash(password, 12)
      console.log('✅ パスワードハッシュ化完了')
    } catch (hashError) {
      console.error('❌ パスワードハッシュ化エラー:', hashError)
      throw hashError
    }
    
    // ユーザー作成
    console.log('🔍 ユーザー作成開始')
    let user
    try {
      user = await prisma.user.create({
        data: {
          name: name?.trim() || null,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          name: true,
        }
      })
      console.log('✅ ユーザー作成完了:', { userId: user.id, email: user.email })
    } catch (createError) {
      console.error('❌ ユーザー作成エラー:', createError)
      throw createError
    }
    
    // 🛡️ セキュリティヘッダーを追加
    console.log('🔍 レスポンス作成')
    const response = NextResponse.json({ 
      message: '会員登録が完了しました',
      user
    })
    
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    console.log('✅ 会員登録API正常完了')
    return response
    
  } catch (err) {
    console.error('💥 Registration error (詳細ログ):', {
      error: err,
      message: err instanceof Error ? err.message : String(err),
      code: (err as any)?.code,
      stack: err instanceof Error ? err.stack : undefined,
      name: err instanceof Error ? err.name : undefined
    })
    
    // 🛡️ セキュリティ強化: エラー詳細の適切な処理
    const errorMessage = err instanceof Error ? err.message : '不明なエラー'
    const errorCode = (err as any)?.code
    
    // データベース関連のエラーかチェック
    if (errorMessage.includes('unique constraint') || errorCode === 'P2002') {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' }, 
        { status: 400 }
      )
    }
    
    // データベース接続エラーの場合
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || errorCode === 'ETIMEDOUT') {
      console.error('❌ データベース接続エラー:', errorMessage)
      return NextResponse.json(
        { error: 'サービスが一時的に利用できません。しばらくお待ちください。' }, 
        { status: 503 }
      )
    }
    
    // Prisma関連のその他のエラー
    if (errorCode?.startsWith('P')) {
      console.error('❌ データベースエラー:', errorCode, errorMessage)
      return NextResponse.json(
        { error: 'データベースエラーが発生しました。管理者にお問い合わせください。' }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { error: '会員登録に失敗しました。時間をおいて再度お試しください。' }, 
      { status: 500 }
    )
  }
}