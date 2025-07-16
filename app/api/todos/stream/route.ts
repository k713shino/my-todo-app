import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Server-Sent Events の実装例
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      // リアルタイムデータの送信ロジック
      const sendUpdate = (data: any) => {
        const message = `data: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }
      
      // 例: 定期的にデータを送信
      const interval = setInterval(() => {
        sendUpdate({ 
          type: 'todo_update', 
          userId,
          timestamp: new Date().toISOString()
        })
      }, 1000)
      
      // クリーンアップ処理
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}

// POST メソッドも必要な場合
export async function POST(request: NextRequest) {
  const _body = await request.json()
  
  // POST処理のロジック
  return NextResponse.json({ success: true })
}