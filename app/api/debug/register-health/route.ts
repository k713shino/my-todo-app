import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * 🔍 メール登録機能のヘルスチェック用デバッグAPI
 * 本番環境での問題診断用
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 メール登録ヘルスチェック開始')
    
    const healthStatus = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: process.env.VERCEL,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPattern: process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.substring(0, 20) + '...' : 'なし'
      },
      libraries: {
        prismaAvailable: !!prisma,
        bcryptAvailable: true // 静的インポートなので常にtrue
      },
      database: {
        connectionTest: 'testing...',
        result: null as any,
        status: '確認中',
        error: null as any,
        code: null as any,
        name: null as any
      }
    }
    
    console.log('🔍 ヘルスチェック基本情報:', healthStatus)
    
    // データベース接続テスト
    try {
      console.log('🔍 データベース接続テスト開始')
      const result = await Promise.race([
        prisma.$queryRaw`SELECT 1 as test, NOW() as server_time`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('接続タイムアウト')), 10000)
        )
      ])
      
      healthStatus.database = {
        connectionTest: 'success',
        result: result,
        status: '正常',
        error: null,
        code: null,
        name: null
      }
      console.log('✅ データベース接続成功:', result)
      
    } catch (dbError) {
      healthStatus.database = {
        connectionTest: 'failed',
        result: null,
        status: 'エラー',
        error: dbError instanceof Error ? dbError.message : String(dbError),
        code: (dbError as any)?.code,
        name: dbError instanceof Error ? dbError.name : undefined
      }
      console.error('❌ データベース接続失敗:', healthStatus.database)
    }
    
    return NextResponse.json({
      success: true,
      health: healthStatus
    })
    
  } catch (error) {
    console.error('💥 ヘルスチェック自体でエラー:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
        name: error instanceof Error ? error.name : undefined
      }
    }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'