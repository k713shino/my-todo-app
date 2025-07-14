import { PrismaClient } from '@prisma/client'

// グローバル型定義
declare global {
  var __prisma: PrismaClient | undefined
}

// Prismaクライアントのシングルトンインスタンス
const createPrismaClient = () => {
  // ビルド時の環境変数チェック
  const databaseUrl = process.env.DATABASE_URL
  
  if (!databaseUrl) {
    console.warn('⚠️ DATABASE_URL is not set. Using default configuration.')
  }
  
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

// シングルトンパターンでPrismaクライアントを管理
const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// 接続テスト関数（ランタイムでのみ実行）
export async function testDatabaseConnection() {
  try {
    // ビルド時は実際の接続テストをスキップ
    if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('localhost')) {
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')
      return true
    } else if (process.env.NODE_ENV === 'development') {
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Database connection successful')
      return true
    }
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// グレースフルシャットダウン
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error during Prisma disconnect:', error)
  }
})

export { prisma }
export default prisma