import { PrismaClient } from '@prisma/client'

// グローバル型定義
declare global {
  var __prisma: PrismaClient | undefined
}

// Prismaクライアントのシングルトンインスタンス
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// シングルトンパターンでPrismaクライアントを管理
const prisma = globalThis.__prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Vercel環境での接続確保
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  prisma.$connect().catch((error) => {
    console.error('Failed to connect to database:', error)
  })
}

// 接続テスト関数
export async function testDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// グレースフルシャットダウン
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})

export { prisma }
export default prisma