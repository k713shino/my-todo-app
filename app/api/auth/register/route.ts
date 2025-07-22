import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Registration API called ===')
    const { name, email, password } = await request.json()
    console.log('Request data:', { name, email, passwordLength: password?.length })
    
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
    console.log('Checking for existing user...')
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })
    console.log('Existing user check result:', existingUser ? 'User exists' : 'User not found')
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' }, 
        { status: 400 }
      )
    }
    
    // パスワードハッシュ化
    console.log('Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 12)
    console.log('Password hashed successfully')
    
    // ユーザー作成
    console.log('Creating user in database...')
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
    console.log('User created successfully:', { id: user.id, email: user.email })
    
    return NextResponse.json({ 
      message: '会員登録が完了しました',
      user
    })
    
  } catch (err) {
    console.error('=== Registration error ===')
    console.error('Error:', err)
    console.error('Error message:', err instanceof Error ? err.message : 'Unknown error')
    console.error('Error stack:', err instanceof Error ? err.stack : null)
    console.error('Environment check:', {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL
    })
    return NextResponse.json(
      { error: '会員登録に失敗しました' }, 
      { status: 500 }
    )
  }
}