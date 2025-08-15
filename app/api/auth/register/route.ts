import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createSecurityHeaders } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
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