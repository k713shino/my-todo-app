import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSecurityHeaders } from '@/lib/auth-utils'

/**
 * 🚨 緊急対応: Lambda API経由でのユーザー登録
 */
async function registerViaLambdaAPI(requestData: any): Promise<NextResponse> {
  console.log('🔄 Lambda API経由登録開始')
  
  const { name, email, password } = requestData
  
  // バリデーション
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: 'メールアドレスと8文字以上のパスワードが必要です' }, 
      { status: 400 }
    )
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: '有効なメールアドレスを入力してください' }, 
      { status: 400 }
    )
  }
  
  // Lambda API経由でユーザー登録
  const requestBody = {
    name: name?.trim() || null,
    email: email.toLowerCase().trim(),
    password: password
  }
  
  console.log('📤 Lambda API登録リクエスト:', {
    url: `${process.env.LAMBDA_API_URL}/auth/register`,
    method: 'POST',
    body: { ...requestBody, password: '[REDACTED]' }
  })
  
  const response = await fetch(`${process.env.LAMBDA_API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })
  
  console.log('📥 Lambda APIレスポンス基本情報:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok
  })
  
  if (!response.ok) {
    let errorData: any = {}
    let responseText = ''
    
    try {
      responseText = await response.text()
      errorData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('❌ Lambda APIレスポンス解析エラー:', parseError)
      errorData = { rawResponse: responseText }
    }
    
    console.error('❌ Lambda API登録エラー詳細:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      errorData: errorData,
      responseText: responseText
    })
    
    if (response.status === 400) {
      return NextResponse.json(
        { error: errorData.error || errorData.message || 'リクエストエラーが発生しました' },
        { status: 400 }
      )
    }
    
    if (response.status === 404) {
      console.error('❌ Lambda API登録エンドポイントが見つかりません')
      throw new Error('Registration endpoint not found')
    }
    
    throw new Error(`Lambda API registration failed: ${response.status} - ${errorData.error || errorData.message || responseText}`)
  }
  
  const data = await response.json()
  console.log('✅ Lambda API経由登録成功')
  
  const responseObj = NextResponse.json({
    message: '会員登録が完了しました',
    user: data.user
  })
  
  const securityHeaders = createSecurityHeaders()
  Object.entries(securityHeaders).forEach(([key, value]) => {
    responseObj.headers.set(key, value)
  })
  
  return responseObj
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 会員登録API開始')
    
    // 環境とライブラリの初期チェック
    console.log('🔍 環境チェック:', {
      nodeEnv: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasLambdaApiUrl: !!process.env.LAMBDA_API_URL,
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
    
    // 🚨 緊急対応: RDS接続問題時はLambda API経由で登録
    if (process.env.LAMBDA_API_URL) {
      console.log('🔄 Lambda API経由での会員登録を試行')
      try {
        return await registerViaLambdaAPI(requestData)
      } catch (lambdaError) {
        console.error('❌ Lambda API登録失敗、Prisma直接接続にフォールバック:', lambdaError)
        // Lambda失敗時はPrisma直接接続を試行
      }
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