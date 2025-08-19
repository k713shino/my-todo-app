/**
 * ユーザー別Todo取得のデバッグAPI
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createAuthErrorResponse } from '@/lib/auth-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { createSecurityHeaders } from '@/lib/security'

export async function GET(request: NextRequest) {
  const startTime = performance.now()
  const authResult = await getAuthenticatedUser(request)
  
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }
  
  const userId = authResult.user.id
  console.log('🔍 ユーザー別Todo取得デバッグ開始:', { userId })
  
  try {
    const diagnostics: any = {
      userId: userId,
      userIdType: typeof userId,
      userIdLength: userId.length,
      timestamp: new Date().toISOString(),
      tests: []
    }
    
    // Test 1: Lambda ヘルスチェック
    try {
      const healthStart = performance.now()
      const healthResponse = await lambdaAPI.get('/')
      const healthTime = performance.now() - healthStart
      
      diagnostics.tests.push({
        name: 'Lambda ヘルスチェック',
        success: healthResponse.success,
        responseTime: Math.round(healthTime),
        error: healthResponse.error || null
      })
    } catch (error) {
      diagnostics.tests.push({
        name: 'Lambda ヘルスチェック',
        success: false,
        responseTime: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: 全Todo取得テスト
    try {
      const allTodosStart = performance.now()
      const allTodosResponse = await lambdaAPI.get('/todos')
      const allTodosTime = performance.now() - allTodosStart
      
      diagnostics.tests.push({
        name: '全Todo取得',
        success: allTodosResponse.success,
        responseTime: Math.round(allTodosTime),
        dataCount: allTodosResponse.success && Array.isArray(allTodosResponse.data) ? allTodosResponse.data.length : 0,
        error: allTodosResponse.error || null
      })
    } catch (error) {
      diagnostics.tests.push({
        name: '全Todo取得',
        success: false,
        responseTime: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 3: ユーザー専用Todo取得テスト
    try {
      const userTodosStart = performance.now()
      const userTodosResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(userId)}`)
      const userTodosTime = performance.now() - userTodosStart
      
      diagnostics.tests.push({
        name: 'ユーザー専用Todo取得',
        endpoint: `/todos/user/${userId}`,
        success: userTodosResponse.success,
        responseTime: Math.round(userTodosTime),
        dataCount: userTodosResponse.success && Array.isArray(userTodosResponse.data) ? userTodosResponse.data.length : 0,
        error: userTodosResponse.error || null,
        sampleData: userTodosResponse.success && Array.isArray(userTodosResponse.data) ? 
          userTodosResponse.data.slice(0, 2).map(todo => ({
            id: todo.id,
            title: todo.title?.substring(0, 30) + '...',
            userId: todo.userId,
            userIdMatches: todo.userId === userId
          })) : null
      })
    } catch (error) {
      diagnostics.tests.push({
        name: 'ユーザー専用Todo取得',
        endpoint: `/todos/user/${userId}`,
        success: false,
        responseTime: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    const totalTime = performance.now() - startTime
    diagnostics.totalTime = Math.round(totalTime)
    
    console.log('🔍 ユーザー別Todo取得デバッグ完了:', diagnostics)
    
    const response = NextResponse.json(diagnostics)
    const securityHeaders = createSecurityHeaders()
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
    
  } catch (error) {
    const totalTime = performance.now() - startTime
    console.error(`❌ デバッグエラー (${totalTime.toFixed(2)}ms):`, error)
    
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      totalTime: Math.round(totalTime)
    }, { status: 500 })
  }
}