import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  try {
    console.log('👤 User update API called')
    
    const session = await getAuthSession()
    console.log('Session:', session ? { userId: session.user?.id, email: session.user?.email } : 'null')
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body keys:', Object.keys(body))
    
    const { name, image } = body

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const actualUserId = extractUserIdFromPrefixed(session.user.id)

    try {
      // Lambda API経由でユーザー情報を更新
      const response = await lambdaAPI.post('/auth/update-user', {
        userId: actualUserId,
        name: name.trim(),
        image: image || null
      })

      console.log('Lambda user update response:', response)

      if (!response.success) {
        console.error('Lambda user update failed:', response.error)
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 400
        if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        } else if (response.error?.includes('required')) {
          statusCode = 400
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
      console.error('Lambda API error:', error)
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ User update API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}