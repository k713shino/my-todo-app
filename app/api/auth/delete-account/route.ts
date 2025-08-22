// app/api/auth/delete-account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    console.log('🗑️ Account deletion request from:', session?.user?.email)
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmationText, password, reason } = body

    // 確認テキストチェック
    if (confirmationText !== 'DELETE') {
      return NextResponse.json(
        { error: '確認テキストが正しくありません。「DELETE」と入力してください。' }, 
        { status: 400 }
      )
    }

    const userId = extractUserIdFromPrefixed(session.user.id)
    console.log('🔍 Deleting account for user:', { 
      userId, 
      email: session.user.email,
      name: session.user.name 
    })

    try {
      // Lambda API経由でアカウント削除を実行
      const response = await lambdaAPI.post('/delete-account', {
        userId,
        userEmail: session.user.email,
        userName: session.user.name,
        confirmationText,
        password,
        reason,
        hasPassword: session.user.hasPassword
      })

      console.log('Lambda delete account response:', response)

      if (!response.success) {
        console.error('Lambda account deletion failed:', response.error)
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 500
        if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        } else if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('maintenance')) {
          statusCode = 503
        } else if (response.error?.includes('confirmation') || response.error?.includes('password')) {
          statusCode = 400
        }
        
        return NextResponse.json({ 
          error: response.error || 'Account deletion failed',
          maintenanceMode: statusCode === 503
        }, { status: statusCode })
      }

      // 削除が成功した場合の統計情報
      const lambdaData = response.data as any
      console.log('✅ Account deleted successfully via Lambda API')
      
      return NextResponse.json({ 
        message: 'アカウントが正常に削除されました',
        deletedAt: lambdaData.deletedAt || new Date().toISOString(),
        stats: lambdaData.stats || {
          todoCount: 0,
          authMethod: session.user.hasPassword ? 'credentials' : 'oauth'
        }
      })

    } catch (error) {
      console.error('❌ Lambda API error during account deletion:', error)
      return NextResponse.json({ 
        error: 'サーバーエラーが発生しました。しばらく後に再試行してください。',
        maintenanceMode: false
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Account deletion API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// OPTIONS メソッドの追加（CORS対応）
export async function OPTIONS(_request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}