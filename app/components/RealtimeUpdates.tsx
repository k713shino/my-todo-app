'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Todo } from '@/types/todo'
import toast from 'react-hot-toast'

interface RealtimeUpdatesProps {
  onTodoUpdate: (todo: Todo) => void
  onTodoCreate: (todo: Todo) => void
  onTodoDelete: (todoId: string) => void
}

// SimpleWebSocket-based real-time updates (Socket.IO alternative)
export default function RealtimeUpdates({ 
  onTodoUpdate, 
  onTodoCreate, 
  onTodoDelete 
}: RealtimeUpdatesProps) {
  const { data: session } = useSession()
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return

    // EventSource for server-sent events (simpler than Socket.IO)
    const eventSource = new EventSource(`/api/todos/stream?userId=${session.user.id}`)
    
    eventSource.onopen = () => {
      console.log('🔗 Real-time connection established')
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        switch (data.type) {
          case 'todo-created':
            console.log('📝 Todo created:', data.todo)
            onTodoCreate(data.todo)
            toast.success(`新しいTodo「${data.todo.title}」が作成されました`)
            break
            
          case 'todo-updated':
            console.log('✏️ Todo updated:', data.todo)
            onTodoUpdate(data.todo)
            toast.success(`Todo「${data.todo.title}」が更新されました`)
            break
            
          case 'todo-deleted':
            console.log('🗑️ Todo deleted:', data.todoId)
            onTodoDelete(data.todoId)
            toast.success(`Todoが削除されました`)
            break
        }
      } catch (error) {
        console.error('Real-time message parse error:', error)
      }
    }

    eventSource.onerror = () => {
      console.log('❌ Real-time connection error')
      setIsConnected(false)
    }

    // クリーンアップ
    return () => {
      eventSource.close()
      setIsConnected(false)
    }
  }, [session?.user?.id, onTodoUpdate, onTodoCreate, onTodoDelete])

  // 接続状態表示（開発用）
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {isConnected ? '🟢 リアルタイム接続中' : '🔴 接続切断'}
        </div>
      </div>
    )
  }

  return null
}