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

// ビルド時の環境判定を強化
const isBuildTime = (): boolean => {
  return (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.CI === 'true' ||
    // Vercelのビルド時を正確に判定
    (process.env.VERCEL === '1' && !process.env.DATABASE_URL) ||
    // 一般的なビルド環境の判定
    process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL
  )
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
      count: async () => 0,
    },
    account: {
      findUnique: async () => null,
      findFirst: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
    session: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
    verificationToken: {
      findUnique: async () => null,
      findFirst: async () => null,
      create: async () => ({}),
      delete: async () => ({}),
      count: async () => 0,
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

// Prismaクライアントの作成（Lambda最適化版）
const createPrismaClient = () => {
  const databaseUrl = getDatabaseUrl()
  
  // Lambda環境の検出
  const isLambdaEnvironment = !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.env.VERCEL || 
    process.env.NETLIFY ||
    process.env.LAMBDA_TASK_ROOT
  )
  
  try {
    const client = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      errorFormat: 'minimal' as const,
    })

    // Lambda環境用の接続最適化
    if (isLambdaEnvironment && !isBuildTime()) {
      console.log('🔗 Initializing Prisma for Lambda environment')
      
      // コネクションプール設定のログ
      const maxConnections = process.env.DATABASE_MAX_CONNECTIONS || '1'
      const connectionTimeout = process.env.PRISMA_CONNECTION_TIMEOUT || '5000'
      console.log(`📊 Lambda DB Config: max=${maxConnections}, timeout=${connectionTimeout}ms`)
      
      // 接続テストは非同期で実行（Lambdaコールドスタート最適化）
      client.$connect().catch((error) => {
        console.warn('⚠️ Prisma Lambda connection warning (non-blocking):', error.message)
      })
    } else if (!isBuildTime()) {
      // 通常環境での接続テスト
      client.$connect().catch((error) => {
        console.warn('Prisma connection warning (non-blocking):', error.message)
      })
    }

    return client
  } catch (error) {
    console.error('Prisma client creation error:', error)
    return createDummyPrismaClient()
  }
}

// シングルトンパターンでPrismaクライアントを管理
const prisma = globalThis.__prisma ?? (() => {
  // ビルド時は常にダミークライアント
  if (isBuildTime()) {
    console.log('🎭 Build time detected - using dummy Prisma client')
    return createDummyPrismaClient()
  }
  
  // 実行時でダミーDBの場合もダミークライアント
  if (process.env.DATABASE_URL?.includes('dummy')) {
    console.warn('⚠️ Using dummy Prisma client due to dummy DATABASE_URL')
    return createDummyPrismaClient()
  }
  
  return createPrismaClient()
})()

// 開発環境でのみグローバルに保存
if (process.env.NODE_ENV !== 'production' && !isBuildTime()) {
  globalThis.__prisma = prisma
}

// 接続テスト関数（ランタイムでのみ実行）
export async function testDatabaseConnection(): Promise<boolean> {
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

// グレースフルシャットダウン（ビルド時以外）
if (typeof process !== 'undefined' && !isBuildTime()) {
  process.on('beforeExit', async () => {
    try {
      await prisma.$disconnect()
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
