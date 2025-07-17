import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1時間に10回まで）
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `update_profile:${session.user.id}`, 
      3600, 
      10
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'プロフィール更新の試行回数が上限に達しました。1時間後に再試行してください。' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email } = body

    // バリデーション
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' }, 
        { status: 400 }
      )
    }

    if (name && name.length > 100) {
      return NextResponse.json(
        { error: '名前は100文字以内で入力してください' }, 
        { status: 400 }
      )
    }

    // メールアドレスの重複チェック
    if (email && email !== session.user.email) {
      const existingUser = await prisma.user.findFirst({
        where: { 
          email: email,
          id: { not: session.user.id }
        }
      })
      
      if (existingUser) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に使用されています' }, 
          { status: 400 }
        )
      }
    }

    // プロフィール更新
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(name !== undefined && { name: name.trim() || null }),
        ...(email !== undefined && { email: email.toLowerCase().trim() }),
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        updatedAt: true
      }
    })

    return NextResponse.json({ 
      message: 'プロフィールが正常に更新されました',
      user: updatedUser
    })

  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: 'プロフィール更新に失敗しました' }, 
      { status: 500 }
    )
  }
}