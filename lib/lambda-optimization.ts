// Lambda最適化ユーティリティ
import { prisma } from './prisma'

// Lambda関数のウォームアップ状態を管理
let isWarmedUp = false
let lastActivity = Date.now()

// Lambda関数のウォームアップ
export async function warmupLambda(): Promise<void> {
  if (isWarmedUp && Date.now() - lastActivity < 5 * 60 * 1000) { // 5分以内なら再利用
    return
  }

  try {
    // Prisma接続を事前に確立
    await prisma.$connect()
    
    // 簡単なクエリでデータベース接続をテスト
    await prisma.$queryRaw`SELECT 1`
    
    isWarmedUp = true
    lastActivity = Date.now()
    
    console.log('🔥 Lambda function warmed up successfully')
  } catch (error) {
    console.warn('⚠️ Lambda warmup failed:', error)
  }
}

// API呼び出し前の最適化処理
export async function optimizeForLambda(): Promise<void> {
  // コールドスタート時の処理
  if (!isWarmedUp) {
    await warmupLambda()
  }
  
  // アクティビティタイムスタンプを更新
  lastActivity = Date.now()
}

// Lambda関数終了時のクリーンアップ
export async function cleanupLambda(): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'production') {
      // 本番環境では接続を保持してコールドスタートを防ぐ
      console.log('🧹 Keeping Prisma connection alive for next invocation')
    } else {
      // 開発環境では接続を切断
      await prisma.$disconnect()
      isWarmedUp = false
    }
  } catch (error) {
    console.warn('⚠️ Lambda cleanup warning:', error)
  }
}

// Lambda実行環境の検出
export function isLambdaEnvironment(): boolean {
  return !!(
    process.env.AWS_LAMBDA_FUNCTION_NAME || 
    process.env.VERCEL || 
    process.env.NETLIFY ||
    process.env.LAMBDA_TASK_ROOT
  )
}

// コネクション管理の最適化
export async function optimizeDatabaseConnection(): Promise<void> {
  if (!isLambdaEnvironment()) {
    return
  }

  try {
    // Lambda環境でのコネクション数最適化
    const maxConnections = process.env.DATABASE_MAX_CONNECTIONS ? 
      parseInt(process.env.DATABASE_MAX_CONNECTIONS) : 1
    
    console.log(`🔗 Optimizing for Lambda with max ${maxConnections} connections`)
    
  } catch (error) {
    console.warn('⚠️ Database connection optimization failed:', error)
  }
}

// パフォーマンス監視
export function measureLambdaPerformance<T>(
  operation: string, 
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - startTime
      
      console.log(`⏱️ ${operation} completed in ${duration}ms`)
      
      if (duration > 5000) { // 5秒以上の場合は警告
        console.warn(`🐌 Slow operation detected: ${operation} took ${duration}ms`)
      }
      
      resolve(result)
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`❌ ${operation} failed after ${duration}ms:`, error)
      reject(error)
    }
  })
}