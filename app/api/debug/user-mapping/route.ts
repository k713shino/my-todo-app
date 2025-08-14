import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/session-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 User mapping debug started')
    
    // セッション情報を取得
    const session = await getAuthSession()
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userName: session?.user?.name,
        userImage: session?.user?.image,
        expires: session?.expires
      },
      environment: {
        useLambdaDB: process.env.USE_LAMBDA_DB,
        lambdaApiUrl: process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL
      }
    }
    
    // Lambda APIから全todoデータを取得して、存在するuserIdを調査
    if (debugInfo.environment.lambdaApiUrl) {
      try {
        console.log('🔍 Fetching all todos from Lambda API...')
        const lambdaResponse = await fetch(`${debugInfo.environment.lambdaApiUrl}/todos`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })
        
        if (lambdaResponse.ok) {
          const todosData = await lambdaResponse.json()
          if (Array.isArray(todosData)) {
            const uniqueUserIds = [...new Set(todosData.map((todo: any) => todo.userId))]
            const todosByUser = uniqueUserIds.reduce((acc: any, userId: string) => {
              acc[userId] = todosData.filter((todo: any) => todo.userId === userId).length
              return acc
            }, {})
            
            debugInfo.database = {
              totalTodos: todosData.length,
              uniqueUsers: uniqueUserIds.length,
              userIds: uniqueUserIds,
              todoCountByUser: todosByUser,
              sampleTodos: todosData.slice(0, 3).map((todo: any) => ({
                id: todo.id,
                title: todo.title,
                userId: todo.userId,
                createdAt: todo.createdAt
              }))
            }
            
            // 現在のセッションユーザーIDがデータベースに存在するかチェック
            if (session?.user?.id) {
              const hasMatchingTodos = todosData.some((todo: any) => todo.userId === session.user.id)
              debugInfo.userMatching = {
                sessionUserIdFoundInDatabase: hasMatchingTodos,
                sessionUserId: session.user.id,
                matchingTodos: hasMatchingTodos ? todosData.filter((todo: any) => todo.userId === session.user.id).length : 0
              }
            }
          }
        } else {
          debugInfo.lambdaError = {
            status: lambdaResponse.status,
            statusText: lambdaResponse.statusText,
            responseText: await lambdaResponse.text()
          }
        }
      } catch (lambdaError) {
        debugInfo.lambdaError = {
          message: lambdaError instanceof Error ? lambdaError.message : String(lambdaError)
        }
      }
    }
    
    return NextResponse.json(debugInfo)
    
  } catch (error) {
    console.error('🚨 User mapping debug error:', error)
    return NextResponse.json({
      error: 'User mapping debug failed',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}