import { NextRequest } from 'next/server'
import { Server as SocketIOServer } from 'socket.io'
import { PubSubManager } from '@/lib/pubsub'

let io: SocketIOServer | null = null

export async function GET(request: NextRequest) {
  if (!io) {
    // Socket.IOサーバー初期化
    const httpServer = (globalThis as any).__HTTP_SERVER__ || createHttpServer()
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    })

    // 接続ハンドラー
    io.on('connection', (socket) => {
      console.log('📡 Client connected:', socket.id)

      // ユーザールーム参加
      socket.on('join-user-room', (userId: string) => {
        socket.join(`user:${userId}`)
        console.log(`👤 User ${userId} joined room`)
      })

      // Redis Pub/Sub統合
      setupRedisPubSub(socket)

      socket.on('disconnect', () => {
        console.log('📡 Client disconnected:', socket.id)
      })
    })
  }

  return new Response('Socket.IO server running', { status: 200 })
}

function setupRedisPubSub(socket: any) {
  // Todo更新通知
  PubSubManager.subscribePattern('todo:*', (channel, data) => {
    const userId = data.userId
    socket.to(`user:${userId}`).emit('todo-updated', data)
  })

  // ユーザーアクティビティ通知  
  PubSubManager.subscribePattern('user:activity:*', (channel, data) => {
    socket.to(`user:${data.userId}`).emit('user-activity', data)
  })
}

function createHttpServer() {
  // HTTP サーバー作成ロジック
  const { createServer } = require('http')
  const server = createServer()
  ;(globalThis as any).__HTTP_SERVER__ = server
  return server
}