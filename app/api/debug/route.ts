import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    console.log('=== Debug API called ===')
    
    // 環境変数チェック
    const env = {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'Set' : 'Not set'
    }
    console.log('Environment variables:', env)
    
    // データベース接続テスト
    console.log('Testing database connection...')
    await prisma.$queryRaw`SELECT 1`
    console.log('Database connection successful')
    
    // ユーザーカウントテスト
    console.log('Testing user count...')
    const userCount = await prisma.user.count()
    console.log('User count:', userCount)
    
    return NextResponse.json({ 
      success: true,
      environment: env,
      userCount,
      message: 'Debug API working'
    })
    
  } catch (err) {
    console.error('=== Debug API error ===')
    console.error('Error:', err)
    console.error('Error message:', err instanceof Error ? err.message : 'Unknown error')
    console.error('Error stack:', err instanceof Error ? err.stack : null)
    
    return NextResponse.json(
      { 
        error: 'Debug API failed',
        message: err instanceof Error ? err.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}