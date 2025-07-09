import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // データベース接続確認
    await prisma.$queryRaw`SELECT 1`
    
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV,
    }
    
    return NextResponse.json(health)
  } catch (error) {
    const health = {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
    
    return NextResponse.json(health, { status: 500 })
  }
}
