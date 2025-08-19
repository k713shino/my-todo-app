/**
 * パフォーマンス監視API
 * システムのレスポンス時間とキャッシュ効率を監視
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-utils'
import { createAuthErrorResponse } from '@/lib/auth-utils'
import { CacheManager } from '@/lib/cache'
import { lambdaAPI } from '@/lib/lambda-api'
import { createSecurityHeaders } from '@/lib/security'

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request)
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }

  try {
    console.log('📊 パフォーマンス監視データ収集開始')
    const startTime = performance.now()
    
    const performanceData = {
      timestamp: new Date().toISOString(),
      userId: authResult.user.id,
      tests: [] as any[]
    }

    // 1. キャッシュ応答速度テスト
    try {
      const cacheStart = performance.now()
      const cachedTodos = await CacheManager.getTodos(authResult.user.id)
      const cacheTime = performance.now() - cacheStart
      
      performanceData.tests.push({
        name: 'Redis キャッシュ応答速度',
        responseTime: Math.round(cacheTime),
        status: cacheTime < 50 ? '🟢 優秀' : cacheTime < 100 ? '🟡 良好' : '🔴 要改善',
        details: {
          hasCachedData: !!cachedTodos,
          cachedItemCount: cachedTodos ? cachedTodos.length : 0
        }
      })
    } catch (error) {
      performanceData.tests.push({
        name: 'Redis キャッシュ応答速度',
        responseTime: -1,
        status: '❌ エラー',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 2. Lambda関数応答速度テスト
    try {
      const lambdaStart = performance.now()
      await lambdaAPI.testConnection()
      const lambdaTime = performance.now() - lambdaStart
      
      performanceData.tests.push({
        name: 'Lambda関数応答速度',
        responseTime: Math.round(lambdaTime),
        status: lambdaTime < 500 ? '🟢 優秀' : lambdaTime < 1500 ? '🟡 良好' : '🔴 要改善',
        details: {
          coldStart: lambdaTime > 3000 ? 'あり' : 'なし'
        }
      })
    } catch (error) {
      performanceData.tests.push({
        name: 'Lambda関数応答速度',
        responseTime: -1,
        status: '❌ エラー',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 3. ユーザー専用API応答速度テスト
    try {
      const userApiStart = performance.now()
      const response = await fetch(`${request.nextUrl.origin}/api/todos/user`, {
        headers: {
          'Cookie': request.headers.get('Cookie') || ''
        }
      })
      const userApiTime = performance.now() - userApiStart
      
      performanceData.tests.push({
        name: 'ユーザー専用API応答速度',
        responseTime: Math.round(userApiTime),
        status: userApiTime < 800 ? '🟢 優秀' : userApiTime < 2000 ? '🟡 良好' : '🔴 要改善',
        details: {
          httpStatus: response.status,
          cacheStatus: response.headers.get('X-Cache-Status') || 'unknown'
        }
      })
    } catch (error) {
      performanceData.tests.push({
        name: 'ユーザー専用API応答速度',
        responseTime: -1,
        status: '❌ エラー',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // 4. 総合評価
    const totalTime = performance.now() - startTime
    const avgResponseTime = performanceData.tests
      .filter(test => test.responseTime > 0)
      .reduce((sum, test) => sum + test.responseTime, 0) / 
      performanceData.tests.filter(test => test.responseTime > 0).length

    performanceData.summary = {
      totalTestTime: Math.round(totalTime),
      averageResponseTime: Math.round(avgResponseTime || 0),
      overallStatus: avgResponseTime < 500 ? '🟢 優秀' : 
                    avgResponseTime < 1200 ? '🟡 良好' : '🔴 要改善',
      recommendations: generateRecommendations(performanceData.tests)
    }

    console.log(`📊 パフォーマンス監視完了 (${totalTime.toFixed(2)}ms):`, performanceData.summary)

    const response = NextResponse.json(performanceData)
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })

    return response

  } catch (error) {
    console.error('❌ パフォーマンス監視エラー:', error)
    
    return NextResponse.json({
      error: 'Performance monitoring failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

function generateRecommendations(tests: any[]): string[] {
  const recommendations: string[] = []
  
  const cacheTest = tests.find(t => t.name.includes('キャッシュ'))
  const lambdaTest = tests.find(t => t.name.includes('Lambda'))
  const apiTest = tests.find(t => t.name.includes('API'))

  if (cacheTest && cacheTest.responseTime > 100) {
    recommendations.push('Redis キャッシュの最適化を検討してください')
  }

  if (lambdaTest && lambdaTest.responseTime > 2000) {
    recommendations.push('Lambda 関数のウォームアップ頻度を増やしてください')
  }

  if (apiTest && apiTest.responseTime > 1500) {
    recommendations.push('API エンドポイントの最適化を検討してください')
  }

  if (!cacheTest?.details?.hasCachedData) {
    recommendations.push('キャッシュの活用を検討してください')
  }

  if (recommendations.length === 0) {
    recommendations.push('パフォーマンスは良好です！')
  }

  return recommendations
}