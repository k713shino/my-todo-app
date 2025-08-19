/**
 * Lambda関数最適化ユーティリティ
 * パフォーマンス測定とLambda関数の最適化機能を提供
 */

/**
 * Lambda関数のパフォーマンス測定
 */
export async function measureLambdaPerformance<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()
  
  try {
    console.log(`🚀 ${operationName} 開始`)
    const result = await operation()
    const endTime = performance.now()
    const duration = endTime - startTime
    
    const performanceLevel = duration < 500 ? '🟢 高速' : 
                            duration < 1000 ? '🟡 普通' : '🔴 要改善'
    
    console.log(`✅ ${operationName} 完了 (${duration.toFixed(2)}ms) ${performanceLevel}`)
    
    return result
  } catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime
    
    console.error(`❌ ${operationName} 失敗 (${duration.toFixed(2)}ms):`, error)
    throw error
  }
}

/**
 * Lambda関数の最適化設定
 */
export async function optimizeForLambda(): Promise<void> {
  // Lambda環境での最適化処理
  // 現在は特別な処理は不要だが、将来的にコネクション管理などを追加可能
  return Promise.resolve()
}

/**
 * Lambda関数のヘルスチェック
 */
export interface LambdaHealthCheck {
  status: 'healthy' | 'unhealthy'
  responseTime: number
  timestamp: string
  details?: any
}

export async function performLambdaHealthCheck(): Promise<LambdaHealthCheck> {
  const startTime = performance.now()
  
  try {
    // 簡単なヘルスチェック実行
    const response = await fetch('/api/health', {
      method: 'GET',
      cache: 'no-store'
    })
    
    const responseTime = performance.now() - startTime
    
    return {
      status: response.ok ? 'healthy' : 'unhealthy',
      responseTime: Math.round(responseTime),
      timestamp: new Date().toISOString(),
      details: {
        httpStatus: response.status,
        statusText: response.statusText
      }
    }
  } catch (error) {
    const responseTime = performance.now() - startTime
    
    return {
      status: 'unhealthy',
      responseTime: Math.round(responseTime),
      timestamp: new Date().toISOString(),
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}