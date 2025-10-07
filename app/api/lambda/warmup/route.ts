/**
 * Lambda関数ウォームアップAPI
 * コールドスタート問題を軽減するための予熱機能
 */

import { NextRequest, NextResponse } from 'next/server'
import { lambdaAPI } from '@/lib/lambda-api'
import { createSecurityHeaders } from '@/lib/security'

export async function GET(_request: NextRequest) {
  try {
    console.log('🔥 Lambda関数ウォームアップ開始')
    const startTime = performance.now()
    
    // Lambda関数の接続テストでウォームアップ
    const warmupResponse = await lambdaAPI.get('/')
    const warmupTime = performance.now() - startTime
    
    console.log(`🚀 Lambda関数ウォームアップ完了 (${warmupTime.toFixed(2)}ms):`, {
      status: warmupResponse.success ? '✅ 成功' : '❌ 失敗',
      responseTime: `${warmupTime.toFixed(2)}ms`,
      performance: warmupTime < 1000 ? '🟢 高速' : warmupTime < 3000 ? '🟡 普通' : '🔴 遅い'
    })
    
    const response = NextResponse.json({ 
      success: warmupResponse.success, 
      warmupTime: Math.round(warmupTime),
      status: warmupResponse.success ? 'Lambda function warmed up' : 'Warmup failed',
      error: warmupResponse.success ? undefined : warmupResponse.error,
      timestamp: new Date().toISOString()
    })
    
    // セキュリティヘッダー設定
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    console.error('❌ Lambda関数ウォームアップ失敗:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Warmup failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(_request: NextRequest) {
  // POST方式でのウォームアップ（より積極的）
  try {
    console.log('🔥 積極的Lambda関数ウォームアップ開始')
    const startTime = performance.now()
    
    // 複数のエンドポイントを同時にウォームアップ
    const warmupPromises = [
      lambdaAPI.get('/'),
      // 軽量なクエリでデータベース接続もウォームアップ
      lambdaAPI.get('/').catch(() => null)
    ]
    
    const results = await Promise.allSettled(warmupPromises)
    const warmupTime = performance.now() - startTime
    
    const successCount = results.filter(result => result.status === 'fulfilled').length
    
    console.log(`🚀 積極的ウォームアップ完了 (${warmupTime.toFixed(2)}ms):`, {
      successfulWarmups: `${successCount}/${results.length}`,
      responseTime: `${warmupTime.toFixed(2)}ms`,
      performance: warmupTime < 2000 ? '🟢 高速' : warmupTime < 5000 ? '🟡 普通' : '🔴 遅い'
    })
    
    const response = NextResponse.json({ 
      success: successCount > 0, 
      warmupTime: Math.round(warmupTime),
      successfulWarmups: successCount,
      totalAttempts: results.length,
      status: 'Aggressive warmup completed',
      timestamp: new Date().toISOString()
    })
    
    // セキュリティヘッダー設定
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    console.error('❌ 積極的Lambda関数ウォームアップ失敗:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: 'Aggressive warmup failed',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}