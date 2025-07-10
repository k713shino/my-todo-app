import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import rateLimit from '@/lib/rateLimit'

// レート制限設定
const limiter = rateLimit({
  interval: 60 * 1000, // 1分
  uniqueTokenPerInterval: 500, // ユニークトークン数
})

export async function POST(request: NextRequest) {
  try {
    // レート制限チェック
    const result = await limiter.check(10, 'REGISTER') // 10回/分
    if (!result.success) {
      return NextResponse.json(
        { error: 'レート制限に達しました。しばらくお待ちください。' }, 
        { status: 429 }
      )
    }

    const { name, email, password } = await request.json()
    
    // 強化されたバリデーション
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '全ての項目を入力してください' }, 
        { status: 400 }
      )
    }

    // パスワード強度チェック
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    if (!passwordRegex.test(password)) {
      return NextResponse.json(
        { error: 'パスワードは8文字以上で、大文字・小文字・数字・特殊文字を含む必要があります' }, 
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
    
    // パスワードハッシュ化（本番環境用強化）
    const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)
    
    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
      }
    })
    
    return NextResponse.json({ 
      message: '会員登録が完了しました',
      user
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '会員登録に失敗しました' }, 
      { status: 500 }
    )
  }
}