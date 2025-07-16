import { NextRequest, NextResponse } from 'next/server'

// 開発環境でのみSocket.IOを有効化
export async function GET(_request: NextRequest) {
  // 本番環境では無効化（Vercelなどのサーバーレス環境ではSocket.IOは動作しない）
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ 
      message: 'Socket.IO is disabled in production (serverless)',
      status: 'disabled'
    }, { status: 200 })
  }

  // 開発環境用の簡単な実装
  try {
    console.log('📡 Socket.IO endpoint accessed')
    
    return NextResponse.json({ 
      message: 'Socket.IO development endpoint',
      status: 'development'
    }, { status: 200 })
  } catch (error) {
    console.error('Socket.IO error:', error)
    return NextResponse.json({ 
      message: 'Socket.IO error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}