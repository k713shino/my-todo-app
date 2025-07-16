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
  metadata?: Record<string, unknown>
}

export interface GlobalNotificationData {
  type: string
  message: string
  data?: Record<string, unknown>
}

// 型安全なコールバック関数の型定義
type MessageCallback = (data: TodoEventData | UserActivityData | GlobalNotificationData) => void
type PatternMessageCallback = (channel: string, data: TodoEventData | UserActivityData | GlobalNotificationData) => void

// PubSub管理クラス
export class PubSubManager {
  // 具体的な型を使用して型安全性を確保します
  private static subscribers = new Map<string, Set<MessageCallback>>()

  // メッセージ発行
  static async publish(channel: string, data: TodoEventData | UserActivityData | GlobalNotificationData): Promise<boolean> {
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

  // グローバル通知発行
  static async publishGlobalNotification(notification: GlobalNotificationData): Promise<boolean> {
    return this.publish(PubSubChannels.globalNotifications, notification)
  }

  // チャンネル購読（型安全版）
  static async subscribe(channel: string, callback: MessageCallback): Promise<boolean> {
    try {
      if (!this.subscribers.has(channel)) {
        this.subscribers.set(channel, new Set<MessageCallback>())
        
        await subClient.subscribe(channel)
        subClient.on('message', (receivedChannel: string, message: string) => {
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

  // チャンネル購読解除（型安全版）
  static async unsubscribe(channel: string, callback?: MessageCallback): Promise<boolean> {
    try {
      const callbacks = this.subscribers.get(channel)
      if (!callbacks) return true

      if (callback) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          await subClient.unsubscribe(channel)
          this.subscribers.delete(channel)
        }
      } else {
        await subClient.unsubscribe(channel)
        this.subscribers.delete(channel)
      }
      
      return true
    } catch (error) {
      console.error('Unsubscribe error:', error)
      return false
    }
  }

  // パターンベース購読（型安全版）
  static async subscribePattern(
    pattern: string, 
    callback: PatternMessageCallback
  ): Promise<boolean> {
    try {
      await subClient.psubscribe(pattern)
      subClient.on('pmessage', (receivedPattern: string, channel: string, message: string) => {
        if (receivedPattern === pattern) {
          try {
            const data = JSON.parse(message)
            callback(channel, data)
          } catch (error) {
            console.error('Pattern message parse error:', error)
          }
        }
      })
      return true
    } catch (error) {
      console.error('Pattern subscribe error:', error)
      return false
    }
  }

  // パターン購読解除
  static async unsubscribePattern(pattern: string): Promise<boolean> {
    try {
      await subClient.punsubscribe(pattern)
      return true
    } catch (error) {
      console.error('Pattern unsubscribe error:', error)
      return false
    }
  }

  // 全購読解除（クリーンアップ用）
  static async unsubscribeAll(): Promise<boolean> {
    try {
      await subClient.unsubscribe()
      await subClient.punsubscribe()
      this.subscribers.clear()
      return true
    } catch (error) {
      console.error('Unsubscribe all error:', error)
      return false
    }
  }
}

export default PubSubManager