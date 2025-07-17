import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    // 1. データベース接続テスト
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection OK')

    // 2. ユーザー一覧取得
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        password: true, // パスワードハッシュの存在確認
        createdAt: true
      }
    })

    console.log('📊 Users in database:', users.length)
    
    // 3. テストユーザーの作成（存在しない場合）
    const testEmail = 'test@example.com'
    let testUser = await prisma.user.findUnique({
      where: { email: testEmail }
    })

    if (!testUser) {
      console.log('🔨 Creating test user...')
      const hashedPassword = await bcrypt.hash('password123', 12)
      
      testUser = await prisma.user.create({
        data: {
          email: testEmail,
          name: 'Test User',
          password: hashedPassword
        }
      })
      console.log('✅ Test user created')
    }

    // 4. パスワード検証テスト
    let passwordTestResult = false
    if (testUser.password) {
      passwordTestResult = await bcrypt.compare('password123', testUser.password)
      console.log('🔐 Password validation test:', passwordTestResult)
    }

    return NextResponse.json({
      status: 'success',
      database: 'connected',
      totalUsers: users.length,
      testUser: {
        email: testUser.email,
        hasPassword: !!testUser.password,
        id: testUser.id,
        passwordTest: passwordTestResult
      },
      users: users.map(u => ({
        email: u.email,
        hasPassword: !!u.password,
        createdAt: u.createdAt
      }))
    })

  } catch (error) {
    console.error('❌ Test Auth Error:', error)
    return NextResponse.json({ 
      error: 'Database error',
      details: error.message 
    }, { status: 500 })
  }
}