import { prisma } from './prisma'

/**
 * 🛡️ 軽量なデータベースヘルスチェック
 * メール登録などの重要な機能で使用する軽量版
 */
export async function lightDatabaseHealthCheck(): Promise<boolean> {
  // ビルド時やダミーURL時はスキップ
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('dummy')) {
    return true
  }

  try {
    // 5秒でタイムアウトする軽量チェック
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Quick health check timeout')), 5000)
      )
    ])
    return true
  } catch (error) {
    console.error('⚠️ 軽量ヘルスチェック失敗:', error instanceof Error ? error.message : error)
    return false
  }
}

/**
 * 🛡️ 本番環境での安全なデータベース操作
 * 実際の操作前に軽量チェックを行い、失敗時は適切にハンドリング
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  operationName: string = 'Database operation'
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    // 本番環境では軽量ヘルスチェックを実行
    if (process.env.NODE_ENV === 'production') {
      const isHealthy = await lightDatabaseHealthCheck()
      if (!isHealthy) {
        console.error(`❌ ${operationName}: ヘルスチェック失敗`)
        return {
          success: false,
          error: 'DATABASE_HEALTH_CHECK_FAILED'
        }
      }
    }

    // 実際のデータベース操作を実行
    const result = await operation()
    return {
      success: true,
      data: result
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as Record<string, unknown>)?.code

    console.error(`❌ ${operationName} 失敗:`, {
      code: errorCode,
      message: errorMessage
    })

    return {
      success: false,
      error: (errorCode as string) || 'UNKNOWN_ERROR'
    }
  }
}