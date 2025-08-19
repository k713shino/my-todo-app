/**
 * Lambda操作のデバッグAPI
 * 作成、更新、削除の問題を診断
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, createAuthErrorResponse } from '@/lib/auth-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export async function GET(request: NextRequest) {
  const authResult = await getAuthenticatedUser(request)
  
  if (!authResult.success || !authResult.user) {
    return createAuthErrorResponse(authResult.error || 'UNAUTHORIZED')
  }
  
  const userId = authResult.user.id
  console.log('🔍 Lambda操作デバッグ開始:', { userId })
  
  try {
    const diagnostics: any = {
      userId: userId,
      timestamp: new Date().toISOString(),
      tests: []
    }
    
    // Test 1: Lambda ヘルスチェック
    try {
      const healthResponse = await lambdaAPI.get('/')
      diagnostics.tests.push({
        name: 'Lambda ヘルスチェック',
        success: healthResponse.success,
        error: healthResponse.error || null
      })
    } catch (error) {
      diagnostics.tests.push({
        name: 'Lambda ヘルスチェック',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 2: 全Todo取得
    try {
      const allTodosResponse = await lambdaAPI.get('/todos')
      const userTodos = allTodosResponse.success && Array.isArray(allTodosResponse.data) 
        ? allTodosResponse.data.filter((todo: any) => todo.userId === userId)
        : []
      
      diagnostics.tests.push({
        name: '全Todo取得+フィルター',
        success: allTodosResponse.success,
        totalTodos: allTodosResponse.success && Array.isArray(allTodosResponse.data) ? allTodosResponse.data.length : 0,
        userTodos: userTodos.length,
        error: allTodosResponse.error || null,
        sampleUserTodos: userTodos.slice(0, 3).map((todo: any) => ({
          id: todo.id,
          title: todo.title?.substring(0, 30),
          userId: todo.userId,
          userIdMatches: todo.userId === userId
        }))
      })
    } catch (error) {
      diagnostics.tests.push({
        name: '全Todo取得+フィルター',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 3: ユーザー専用Todo取得
    try {
      const userTodosResponse = await lambdaAPI.get(`/todos/user/${encodeURIComponent(userId)}`)
      diagnostics.tests.push({
        name: 'ユーザー専用Todo取得',
        endpoint: `/todos/user/${userId}`,
        success: userTodosResponse.success,
        dataCount: userTodosResponse.success && Array.isArray(userTodosResponse.data) ? userTodosResponse.data.length : 0,
        error: userTodosResponse.error || null
      })
    } catch (error) {
      diagnostics.tests.push({
        name: 'ユーザー専用Todo取得',
        endpoint: `/todos/user/${userId}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    // Test 4: Todo作成テスト
    try {
      const testTodoData = {
        title: 'テスト用Todo - ' + new Date().toISOString(),
        description: 'デバッグ用の一時的なTodo',
        userId: userId,
        userEmail: authResult.user.email,
        userName: authResult.user.name,
        priority: 'LOW'
      }
      
      const createResponse = await lambdaAPI.post('/todos', testTodoData)
      diagnostics.tests.push({
        name: 'Todo作成テスト',
        success: createResponse.success,
        createdTodoId: createResponse.success ? createResponse.data?.id : null,
        error: createResponse.error || null
      })
      
      // 作成したTodoをすぐに削除（クリーンアップ）
      if (createResponse.success && createResponse.data?.id) {
        try {
          const deleteResponse = await lambdaAPI.delete(`/todos/${createResponse.data.id}?userId=${encodeURIComponent(userId)}`)
          diagnostics.tests.push({
            name: 'Todo削除テスト（クリーンアップ）',
            success: deleteResponse.success,
            deletedTodoId: createResponse.data.id,
            error: deleteResponse.error || null
          })
        } catch (deleteError) {
          diagnostics.tests.push({
            name: 'Todo削除テスト（クリーンアップ）',
            success: false,
            error: deleteError instanceof Error ? deleteError.message : 'Unknown error'
          })
        }
      }
      
    } catch (error) {
      diagnostics.tests.push({
        name: 'Todo作成テスト',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
    
    console.log('🔍 Lambda操作デバッグ完了:', diagnostics)
    
    return NextResponse.json(diagnostics)
    
  } catch (error) {
    console.error('❌ デバッグエラー:', error)
    
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}