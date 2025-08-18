import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/session-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No session found'
      })
    }

    // セッション情報をデバッグ用に詳細表示
    const sessionDebug = {
      user: {
        id: session.user?.id,
        idType: typeof session.user?.id,
        idLength: session.user?.id?.length,
        email: session.user?.email,
        name: session.user?.name,
        image: session.user?.image,
        hasPassword: session.user?.hasPassword
      },
      expires: session.expires,
      timestamp: new Date().toISOString()
    }

    console.log('🔍 Session Debug Info:', sessionDebug)

    // OAuth認証ユーザーIDの数値変換テスト
    const numericUserId = session.user?.id ? parseInt(session.user.id, 10) : NaN
    const isNumericValid = !isNaN(numericUserId)
    
    return NextResponse.json({
      success: true,
      sessionInfo: sessionDebug,
      numericConversion: {
        original: session.user?.id,
        converted: numericUserId,
        isValid: isNumericValid,
        canUseForLambda: isNumericValid
      }
    })
  } catch (error) {
    console.error('❌ Session debug error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}