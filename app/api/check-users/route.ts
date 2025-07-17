import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // ユーザー数とサンプルユーザーを確認
    const userCount = await prisma.user.count()
    
    const sampleUsers = await prisma.user.findMany({
      take: 5,
      select: {
        id: true,
        email: true,
        name: true,
        password: true, // パスワードハッシュの存在確認
        createdAt: true
      }
    })

    return NextResponse.json({
      status: 'success',
      userCount,
      users: sampleUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        hasPassword: !!user.password,
        passwordLength: user.password?.length || 0,
        createdAt: user.createdAt
      }))
    })
  } catch (error) {
    console.error('Error checking users:', error)
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 })
  }
}