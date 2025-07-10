import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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
        name,
        email,
        password: hashedPassword,
      }
    })
    
    return NextResponse.json({ 
      message: '会員登録が完了しました',
      user: { id: user.id, email: user.email, name: user.name }
    })
    
  } catch (err) {
    console.error('Registration error:', err)
    return NextResponse.json(
      { error: '会員登録に失敗しました' }, 
      { status: 500 }
    )
  }
}