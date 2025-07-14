import { pubClient, subClient } from './redis'
import { Todo } from '@/types/todo'

// PubSubチャンネル定義
export const PubSubChannels = {
  todoUpdated: (userId: string) => `todo:updated:${userId}`,
  todoCreated: (userId: string) => `todo:created:${userId}`,
  todoDeleted: (userId: string) => `todo:deleted:${userId}`,
  userActivity: (userId: string) => `user:activity:${userId}`,
  globalNotifications: 'notifications:global',
} as const

// イベントデータ型定義
export interface TodoEventData {
  type: 'created' | 'updated' | 'deleted'
  todo: Todo | { id: string; userId: string }
  userId: string
  timestamp: number
}

export interface UserActivityData {
  userId: string
  action: string
  timestamp: number
  metadata?: Record<string, any>
}

// PubSub管理クラス
export class PubSubManager {
  private static subscribers = new Map<string, Set<Function>>()

  // メッセージ発行
  static async publish(channel: string, data: any): Promise<boolean> {
    try {
      await pubClient.publish(channel, JSON.stringify({
        ...data,
        timestamp: Date.now()
      }))
      return true
    } catch (error) {
      console.error('Publish error:', error)
      return false
    }
  }

  // チャンネル購読
  static async subscribe(channel: string, callback: (data: any) => void): Promise<boolean> {
    try {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set())
        
        await subClient.subscribe(channel)
        subClient.on('message', (receivedChannel, message) => {
          if (receivedChannel === channel) {
            try {
              const data = JSON.parse(message)
              const callbacks = this.subscribers.get(channel)
              if (callbacks) {
                callbacks.forEach(cb => cb(data))
              }
            } catch (error) {
              console.error('Message parse error:', error)
            }
          }
        })
      }
      
      this.subscribers.get(channel)?.add(callback)
      return true
    } catch (error) {
      console.error('Subscribe error:', error)
      return false
    }
  }

  // Todo関連イベント発行
  static async publishTodoEvent(eventData: TodoEventData): Promise<boolean> {
    const { userId, type } = eventData
    
    let channel: string
    switch (type) {
      case 'created':
        channel = PubSubChannels.todoCreated(userId)
        break
      case 'updated':
        channel = PubSubChannels.todoUpdated(userId)
        break
      case 'deleted':
        channel = PubSubChannels.todoDeleted(userId)
        break
      default:
        return false
    }

    return this.publish(channel, eventData)
  }

  // ユーザーアクティビティ発行
  static async publishUserActivity(activityData: UserActivityData): Promise<boolean> {
    const channel = PubSubChannels.userActivity(activityData.userId)
    return this.publish(channel, activityData)
  }
}

export default PubSubManager