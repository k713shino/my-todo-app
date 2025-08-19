import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export const dynamic = 'force-dynamic'

export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, image } = await request.json()

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

      if (!response.success) {
        return NextResponse.json({ 
          error: response.error || 'User update failed' 
        }, { status: 400 })
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