import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed, getAuthMethodFromUserId } from '@/lib/user-id-utils'
import bcrypt from 'bcryptjs'
import { lambdaAPI } from '@/lib/lambda-api'

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クレデンシャル認証のユーザーのみ許可
    const authMethod = getAuthMethodFromUserId(session.user.id)
    if (authMethod !== 'email') {
      return NextResponse.json({ 
        error: 'Password change is only available for email authentication users' 
      }, { status: 403 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: 'Current password and new password are required' 
      }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ 
        error: 'New password must be at least 8 characters long' 
      }, { status: 400 })
    }

    const actualUserId = extractUserIdFromPrefixed(session.user.id)

    try {
      // Lambda API経由で現在のパスワードを確認し、新しいパスワードに更新
      const response = await lambdaAPI.post('/auth/change-password', {
        userId: actualUserId,
        currentPassword,
        newPassword
      })

      console.log('Lambda password change response:', response)

      if (!response.success) {
        console.error('Lambda password change failed:', response.error)
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 400
        if (response.error?.includes('Invalid') || response.error?.includes('incorrect')) {
          statusCode = 400
        } else if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        }
        
        return NextResponse.json({ 
          error: response.error || 'Password change failed' 
        }, { status: statusCode })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Password changed successfully' 
      })

    } catch (error) {
      console.error('Password change error:', error)
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Password change API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
