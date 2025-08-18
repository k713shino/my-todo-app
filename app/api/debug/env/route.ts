import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // 重要な環境変数の存在確認（値は表示しない）
    const envCheck = {
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
      LAMBDA_API_URL: process.env.LAMBDA_API_URL || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      VERCEL_ENV: process.env.VERCEL_ENV,
      timestamp: new Date().toISOString()
    }

    console.log('🔧 Environment Debug Check:', envCheck)

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: 'Environment variables checked'
    })
  } catch (error) {
    console.error('❌ Environment check error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}