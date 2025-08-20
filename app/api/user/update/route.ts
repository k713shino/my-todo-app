import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  // セッション処理テスト
  console.log('🚀 === SESSION TEST API called at:', new Date().toISOString(), '===')
  
  try {
    console.log('0️⃣ API route started')
    
    // セッション処理をテスト
    console.log('1️⃣ Starting session validation...')
    
    let session;
    try {
      console.log('1.1️⃣ Calling getAuthSession()...')
      session = await getAuthSession()
      console.log('1.2️⃣ getAuthSession() completed')
    } catch (sessionError) {
      console.error('1️⃣❌ Session error:', {
        error: sessionError,
        message: sessionError instanceof Error ? sessionError.message : 'Unknown',
        stack: sessionError instanceof Error ? sessionError.stack : 'No stack'
      })
      
      // セッションエラーの詳細を返す
      return NextResponse.json({
        error: 'Session error',
        details: sessionError instanceof Error ? sessionError.message : 'Unknown session error',
        test: 'session_failed',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    console.log('2️⃣ Session retrieved:', session ? { userId: session.user?.id, email: session.user?.email } : 'null')
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    console.log('3️⃣ Session validation passed')
    
    // リクエストボディ解析をテスト
    console.log('4️⃣ Parsing request body...')
    let body;
    try {
      body = await request.json()
      console.log('5️⃣ Request body parsed successfully:', body)
      console.log('Request body keys:', Object.keys(body))
    } catch (bodyError) {
      console.error('4️⃣❌ Body parsing error:', {
        error: bodyError,
        message: bodyError instanceof Error ? bodyError.message : 'Unknown',
        stack: bodyError instanceof Error ? bodyError.stack : 'No stack'
      })
      
      return NextResponse.json({
        error: 'Request body parsing error',
        details: bodyError instanceof Error ? bodyError.message : 'Unknown body parsing error',
        test: 'body_parsing_failed',
        timestamp: new Date().toISOString()
      }, { status: 500 })
    }
    
    const { name, image } = body
    
    console.log('6️⃣ Validating name field...')
    if (!name || name.trim().length === 0) {
      console.log('❌ Name validation failed:', { name, hasName: !!name, trimLength: name?.trim()?.length })
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    console.log('7️⃣ Extracting user ID...')
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    console.log('8️⃣ User ID extracted:', actualUserId)
    
    // リクエストボディ解析が成功した場合
    return NextResponse.json({ 
      test: 'body_parsing_working',
      session: {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      },
      requestData: {
        name,
        image,
        actualUserId
      },
      timestamp: new Date().toISOString() 
    }, { status: 200 })

    /*
    console.log('4️⃣ Parsing request body...')
    const body = await request.json()
    console.log('5️⃣ Request body parsed:', body)
    console.log('Request body keys:', Object.keys(body))
    
    const { name, image } = body

    console.log('6️⃣ Validating name field...')
    if (!name || name.trim().length === 0) {
      console.log('❌ Name validation failed:', { name, hasName: !!name, trimLength: name?.trim()?.length })
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    console.log('7️⃣ Extracting user ID...')
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    console.log('8️⃣ Preparing Lambda API call with:', {
      endpoint: '/auth/update-user',
      userId: actualUserId,
      name: name.trim(),
      image: image || null
    })

    try {
      console.log('9️⃣ Making Lambda API call...')
      // Lambda API経由でユーザー情報を更新
      const response = await lambdaAPI.post('/auth/update-user', {
        userId: actualUserId,
        name: name.trim(),
        image: image || null
      })

      console.log('🔟 Lambda user update response received:', response)

      if (!response.success) {
        console.error('🚨 Lambda user update failed:', {
          error: response.error,
          timestamp: response.timestamp,
          fullResponse: response
        })
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 400
        if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        } else if (response.error?.includes('required')) {
          statusCode = 400
        } else if (response.error?.includes('500') || response.error?.includes('Internal Server Error')) {
          statusCode = 500
        }
        
        return NextResponse.json({ 
          error: response.error || 'User update failed' 
        }, { status: statusCode })
      }

      console.log('✅ User updated successfully via Lambda:', actualUserId)

      return NextResponse.json({
        success: true,
        user: {
          id: session.user.id, // prefixed ID for frontend
          name: name.trim(),
          email: session.user.email,
          image: image || null
        }
      })

    } catch (error) {
      console.error('🚨💥 Lambda API catch block error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack',
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      })
      
      const errorResponse = { 
        error: 'Lambda API error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined,
        debugInfo: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          timestamp: new Date().toISOString()
        }
      }
      
      console.log('🚨📤 Sending Lambda API error response:', errorResponse)
      return NextResponse.json(errorResponse, { status: 500 })
    }
    */

  } catch (error) {
    console.error('🚨💥 Outer catch block error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack',
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    })
    
    const errorResponse = {
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined,
      debugInfo: {
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        timestamp: new Date().toISOString(),
        location: 'API_ROUTE_OUTER_CATCH'
      }
    }
    
    console.log('🚨📤 Sending outer error response:', errorResponse)
    return NextResponse.json(errorResponse, { status: 500 })
  }
}