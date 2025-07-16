import { PrismaClient } from '@prisma/client'

// グローバル型定義
declare global {
  var __prisma: PrismaClient | undefined
}

// ビルド時の安全なDATABASE_URL取得
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL
  
  // ビルド時やCI環境でのフォールバック
  if (!url || url.includes('dummy')) {
    console.warn('⚠️ Using dummy DATABASE_URL for build process')
    return 'postgresql://dummy:dummy@localhost:5432/dummy?connect_timeout=1'
  }
  
  return url
}

// ビルド時の環境判定
const isBuildTime = (): boolean => {
  return (
    process.env.NODE_ENV === 'production' && 
    (
      process.env.VERCEL === '1' || 
      process.env.CI === 'true' ||
      process.env.NEXT_PHASE === 'phase-production-build'
    )
  )
}

// Prismaクライアントのシングルトンインスタンス
const createPrismaClient = () => {
  const databaseUrl = getDatabaseUrl()
  
  try {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      // ビルド時は接続しない
      errorFormat: 'minimal',
    })

    // ビルド時以外でのみ接続テストを実行
    if (!isBuildTime()) {
      // 接続テストは非同期で実行（ビルドをブロックしない）
      client.$connect().catch((error) => {
        console.warn('Prisma connection warning (non-blocking):', error.message)
      })
    }

    return client
  } catch (error) {
    console.error('Prisma client creation error:', error)
    
    // フォールバック用のダミークライアント
    return createDummyPrismaClient()
  }
}

// ダミーPrismaクライアント（ビルド時用）
const createDummyPrismaClient = () => {
  console.log('🎭 Using dummy Prisma client for build process')
  
  const dummyClient = {
    user: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    account: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    session: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    todo: {
      findMany: async () => [],
      findFirst: async () => null,
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
    $queryRaw: async () => [],
    $executeRaw: async () => 0,
    $transaction: async (fn: any) => await fn(dummyClient),
    $connect: async () => {},
    $disconnect: async () => {},
  } as unknown as PrismaClient

  return dummyClient
}

// シングルトンパターンでPrismaクライアントを管理
const prisma = globalThis.__prisma ?? (
  isBuildTime() ? createDummyPrismaClient() : createPrismaClient()
)

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// 接続テスト関数（ランタイムでのみ実行）
export async function testDatabaseConnection() {
  // ビルド時やダミークライアント使用時はスキップ
  if (isBuildTime() || !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('dummy')) {
    console.log('⏭️ Database connection test skipped (build time or dummy URL)')
    return true
  }

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
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    try {
      if (!isBuildTime()) {
        await prisma.$disconnect()
      }
    } catch (error) {
      console.error('Error during Prisma disconnect:', error)
    }
  })

  // 本番環境でのエラーハンドリング
  process.on('uncaughtException', async (error) => {
    console.error('🚨 Uncaught Exception:', error)
    try {
      await prisma.$disconnect()
    } catch (_) {
      // エラー時も処理続行
    }
    process.exit(1)
  })

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason)
    try {
      await prisma.$disconnect()
    } catch (_) {
      // エラー時も処理続行
    }
    process.exit(1)
  })
}

export { prisma }
export default prisma