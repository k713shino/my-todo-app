import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma, testDatabaseConnection } from '@/lib/prisma'
import { createSecurityHeaders } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // 🛡️ セキュリティ強化: データベース接続確認
    const dbConnectionResult = await testDatabaseConnection()
    if (!dbConnectionResult.success) {
      console.error('❌ 会員登録: データベース接続失敗:', dbConnectionResult.details)
      return NextResponse.json(
        { error: 'サービスが一時的に利用できません。しばらくお待ちください。' },
        { status: 503 }
      )
    }

    const { name, email, password } = await request.json()
    
    // バリデーション
    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: 'メールアドレスと8文字以上のパスワードが必要です' }, 
        { status: 400 }
      )
    }
    
    // メールアドレス形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' }, 
        { status: 400 }
      )
    }
    
    // 既存ユーザーチェック
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' }, 
        { status: 400 }
      )
    }
    
    // パスワードハッシュ化
    const hashedPassword = await bcrypt.hash(password, 12)
    
    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        name: name?.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
      }
    })
    
    // 🛡️ セキュリティヘッダーを追加
    const response = NextResponse.json({ 
      message: '会員登録が完了しました',
      user
    })
    
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (err) {
    console.error('Registration error:', err)
    
    // 🛡️ セキュリティ強化: エラー詳細の適切な処理
    const errorMessage = err instanceof Error ? err.message : '不明なエラー'
    
    // データベース関連のエラーかチェック
    if (errorMessage.includes('unique constraint') || errorMessage.includes('P2002')) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' }, 
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: '会員登録に失敗しました。時間をおいて再度お試しください。' }, 
      { status: 500 }
    )
  }
}