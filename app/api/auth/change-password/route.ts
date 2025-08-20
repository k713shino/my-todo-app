import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed, getAuthMethodFromUserId } from '@/lib/user-id-utils'
import bcrypt from 'bcryptjs'
import { lambdaAPI } from '@/lib/lambda-api'

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Password change API called')
    
    const session = await getAuthSession()
    console.log('Session:', session ? { userId: session.user?.id, email: session.user?.email } : 'null')
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // クレデンシャル認証のユーザーのみ許可
    const authMethod = getAuthMethodFromUserId(session.user.id)
    console.log('Auth method:', authMethod, 'for user:', session.user.id)
    
    if (authMethod !== 'email') {
      console.log('❌ OAuth user attempting password change')
      return NextResponse.json({ 
        error: 'Password change is only available for email authentication users' 
      }, { status: 403 })
    }

    const body = await request.json()
    console.log('🔍 Request body keys:', Object.keys(body))
    console.log('🔍 Has passwords:', { 
      hasCurrentPassword: !!body.currentPassword, 
      hasNewPassword: !!body.newPassword,
      currentPasswordLength: body.currentPassword?.length,
      newPasswordLength: body.newPassword?.length
    })
    
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      console.log('❌ Password validation failed:', { currentPassword: !!currentPassword, newPassword: !!newPassword })
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
    console.log('🔄 Calling Lambda API for password change:', {
      endpoint: '/auth/change-password',
      userId: actualUserId,
      hasCurrentPassword: !!currentPassword,
      hasNewPassword: !!newPassword
    })

    try {
      // Lambda API経由で現在のパスワードを確認し、新しいパスワードに更新
      const response = await lambdaAPI.post('/auth/change-password', {
        userId: actualUserId,
        currentPassword,
        newPassword
      })

      console.log('Lambda password change response:', response)

      if (!response.success) {
        console.error('🚨 Lambda password change failed:', {
          error: response.error,
          timestamp: response.timestamp,
          fullResponse: response
        })
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 400
        if (response.error?.includes('Invalid') || response.error?.includes('incorrect')) {
          statusCode = 400
        } else if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        } else if (response.error?.includes('500') || response.error?.includes('Internal Server Error')) {
          statusCode = 500
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
        error: 'Lambda API error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Password change API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
    }, { status: 500 })
  }
}
