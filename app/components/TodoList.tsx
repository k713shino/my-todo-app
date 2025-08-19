'use client'

import { useState, useEffect } from 'react'
import { Priority } from '@prisma/client'
import type { Todo, CreateTodoData, TodoStats, TodoFilters } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
import TodoFiltersComponent from './TodoFilters'
import TodoStatsDisplay from './TodoStatsDisplay'
// import RealtimeUpdates from './RealtimeUpdates'
import { Toaster, toast } from 'react-hot-toast'
import { safeParseTodoDate } from '@/lib/date-utils'
import { 
  retryWithBackoff, 
  getErrorMessage, 
  isTemporaryError, 
  logApiError,
  type ErrorWithStatus 
} from '@/lib/error-utils'


/**
 * APIレスポンスのTodoデータ型定義
 * バックエンドから返される日付は文字列形式
 */
interface TodoResponse {
  id: string
  title: string
  description?: string | null
  completed: boolean
  priority: Priority
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  userId: string
}

/**
 * Todo更新時のリクエストデータ型定義
 * 各フィールドは任意更新可能
 */
interface UpdateTodoData {
  completed?: boolean
  title?: string
  description?: string
  priority?: Priority
  dueDate?: Date | null
}

/**
 * Todoリストコンポーネント
 *
 * 主な機能:
 * - Todoの一覧表示、作成、更新、削除
 * - 完了状態、優先度、検索キーワードによるフィルタリング
 * - リアルタイム更新
 * - Todo統計情報の表示
 */
export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [filter, setFilter] = useState<TodoFilters>({})
  const [lambdaWarmedUp, setLambdaWarmedUp] = useState(false)

  /**
   * Lambda関数ウォームアップ機能
   * コールドスタート問題を軽減
   */
  const warmupLambda = async () => {
    if (lambdaWarmedUp) return // 既にウォームアップ済み
    
    try {
      console.log('🔥 Lambda関数ウォームアップ開始（バックグラウンド）')
      const warmupStart = performance.now()
      
      // 非同期でウォームアップ実行（UI をブロックしない）
      fetch('/api/lambda/warmup', { 
        method: 'GET',
        cache: 'no-store' 
      }).then(async (response) => {
        const warmupTime = performance.now() - warmupStart
        const result = await response.json()
        
        if (result.success) {
          console.log(`🚀 Lambda関数ウォームアップ完了 (${warmupTime.toFixed(2)}ms)`)
          setLambdaWarmedUp(true)
        } else {
          console.warn('⚠️ Lambda関数ウォームアップ失敗:', result.error)
        }
      }).catch(error => {
        console.warn('⚠️ Lambda関数ウォームアップエラー:', error)
      })
    } catch (error) {
      console.warn('⚠️ Lambda関数ウォームアップエラー:', error)
    }
  }

  /**
   * サーバーからTodo一覧を取得
   * 取得したデータの日付文字列をDateオブジェクトに変換
   * 改善されたエラーハンドリングとリトライ機能付き
   */
  const fetchTodos = async (bypassCache = false) => {
    const startTime = performance.now()
    
    try {
      console.log('⚡ 高速Todo取得開始:', { bypassCache, 現在のTodos数: todos.length });
      
      // 🚀 最適化されたユーザー専用エンドポイント使用
      const url = bypassCache 
        ? `/api/todos/user?cache=false&_t=${Date.now()}` 
        : `/api/todos/user`
      
      // リトライ機能付きの高速フェッチ
      const response = await retryWithBackoff(async () => {
        const fetchStart = performance.now()
        const res = await fetch(url, {
          ...(bypassCache ? {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          } : {
            cache: 'default'
          })
        })
        const fetchTime = performance.now() - fetchStart
        console.log(`📡 API呼び出し時間: ${fetchTime.toFixed(2)}ms`)
        return res
      }, {
        maxRetries: 2,
        shouldRetry: (error) => {
          // ネットワークエラーまたは5xx系エラーのみリトライ
          return error.name === 'TypeError' || 
                 (error as any).status >= 500
        }
      })
      
      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const data: TodoResponse[] = await response.json()
      const totalTime = performance.now() - startTime
      
      // パフォーマンス分析
      const performanceLevel = totalTime < 500 ? '🟢 高速' : 
                              totalTime < 1000 ? '🟡 普通' : '🔴 要改善'
      
      console.log(`✅ Todo取得完了 (${totalTime.toFixed(2)}ms) ${performanceLevel}:`, {
        todoCount: data.length,
        cacheStatus: response.headers.get('X-Cache-Status'),
        apiResponseTime: response.headers.get('X-Response-Time'),
        lambdaWarmedUp
      });
      
      const parsedTodos = data.map((todo) => safeParseTodoDate(todo));
      setTodos(parsedTodos)
      
      // パフォーマンスが1秒を超えた場合の警告
      if (totalTime > 1000) {
        console.warn(`⚠️ パフォーマンス警告: 読み込みに${totalTime.toFixed(2)}msかかりました`)
        
        // Lambda関数のウォームアップを次回のために実行
        if (!lambdaWarmedUp) {
          warmupLambda()
        }
      }
      
    } catch (error) {
      const totalTime = performance.now() - startTime
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, `Todo取得 (${totalTime.toFixed(2)}ms)`)
      
      // ユーザーフレンドリーなエラーメッセージ
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(friendlyMessage)
      
      // エラー後にウォームアップを試行（次回のパフォーマンス向上のため）
      if (!lambdaWarmedUp) {
        warmupLambda()
      }
      
      // キャッシュからのフォールバック取得を試行
      if (!bypassCache) {
        try {
          console.log('🔄 キャッシュからのフォールバック取得を試行...')
          const cachedResponse = await fetch('/api/todos/user?cache=true')
          if (cachedResponse.ok) {
            const cachedData = await cachedResponse.json()
            if (cachedData.length > 0) {
              const parsedTodos = cachedData.map((todo: TodoResponse) => safeParseTodoDate(todo));
              setTodos(parsedTodos)
              toast.success('📦 キャッシュからデータを復旧しました')
              return
            }
          }
        } catch (fallbackError) {
          console.warn('キャッシュからの復旧も失敗:', fallbackError)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 新規Todoの作成
   * 改善されたエラーハンドリング付き
   */
  const handleCreateTodo = async (data: CreateTodoData) => {
    setIsSubmitting(true)
    
    // 楽観的UI更新：即座に新しいTodoをUIに追加
    const tempId = `temp-${Date.now()}`
    const optimisticTodo: Todo = {
      id: tempId,
      title: data.title,
      description: data.description || null,
      completed: false,
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'current-user',
      category: undefined,
      tags: []
    }
    
    console.log('🔵 楽観的UI更新 - 追加:', { tempId, title: data.title });
    setTodos(prev => [optimisticTodo, ...prev])
    
    try {
      const response = await retryWithBackoff(async () => {
        return await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const newTodo: TodoResponse = await response.json()
      console.log('✅ API成功レスポンス:', newTodo);
      
      // 一時的なTodoを実際のTodoで置き換え
      setTodos(prev => prev.map(todo => 
        todo.id === tempId 
          ? safeParseTodoDate({ ...newTodo })
          : todo
      ))
      toast.success('📝 新しいTodoを作成しました！')
      
      // キャッシュをクリアして次回取得時に最新データを取得
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        console.log('✨ キャッシュクリア完了')
      } catch (error) {
        console.log('⚠️ キャッシュクリア失敗:', error)
      }
      
    } catch (error) {
      // エラー時は楽観的更新を取り消し
      setTodos(prev => prev.filter(todo => todo.id !== tempId))
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo作成')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo作成エラー: ${friendlyMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Todoの更新
   * 改善されたエラーハンドリング付き
   */
  const handleUpdateTodo = async (id: string, data: UpdateTodoData) => {
    // 楽観的UI更新：即座にUIを更新
    const originalTodos = todos
    setTodos(prev => prev.map(todo => 
      todo.id === id 
        ? { ...todo, ...data, updatedAt: new Date() }
        : todo
    ))
    
    try {
      const response = await retryWithBackoff(async () => {
        return await fetch(`/api/todos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const updatedTodo: TodoResponse = await response.json()
      // 実際のレスポンスでUIを更新
      setTodos(prev => prev.map(todo => 
        todo.id === id 
          ? safeParseTodoDate({ ...updatedTodo })
          : todo
      ))
      toast.success('✅ Todoを更新しました！')
      
      // キャッシュをクリアして次回取得時に最新データを取得
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        console.log('✨ キャッシュクリア完了')
      } catch (error) {
        console.log('⚠️ キャッシュクリア失敗:', error)
      }
      
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo更新')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo更新エラー: ${friendlyMessage}`)
    }
  }

  /**
   * Todoの削除
   * 改善されたエラーハンドリング付き
   */
  const handleDeleteTodo = async (id: string) => {
    // 楽観的UI更新：即座にUIから削除
    const originalTodos = todos
    setTodos(prev => prev.filter(todo => todo.id !== id))
    
    try {
      console.log('🗑️ Todo削除開始:', id)
      
      const response = await retryWithBackoff(async () => {
        return await fetch(`/api/todos/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      console.log('📡 削除レスポンス:', response.status, response.statusText)

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      toast.success('🗑️ Todoを削除しました！')
      
      // キャッシュをクリアして次回取得時に最新データを取得
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        console.log('✨ キャッシュクリア完了')
      } catch (error) {
        console.log('⚠️ キャッシュクリア失敗:', error)
      }
      
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo削除')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo削除エラー: ${friendlyMessage}`)
    }
  }

  /**
   * Todo編集フォームの送信処理
   */
  const handleEditSubmit = async (data: CreateTodoData) => {
    if (!editingTodo) return

    setIsSubmitting(true)
    try {
      await handleUpdateTodo(editingTodo.id, data)
      setEditingTodo(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * フィルター条件に基づいてTodoを検索
   * 検索APIを使用して高度なフィルタリングを実行
   */
  const searchTodos = async (filters: TodoFilters) => {
    try {
      setIsLoading(true)
      
      // フィルター条件が空の場合は通常のTodo一覧を取得
      const hasFilters = Object.keys(filters).some(key => 
        filters[key as keyof TodoFilters] !== undefined && 
        filters[key as keyof TodoFilters] !== '' &&
        !(Array.isArray(filters[key as keyof TodoFilters]) && (filters[key as keyof TodoFilters] as any[]).length === 0)
      )
      
      if (!hasFilters) {
        await fetchTodos()
        return
      }

      // 検索APIを呼び出し
      const params = new URLSearchParams()
      if (filters.search) params.append('q', filters.search)
      if (filters.completed !== undefined) params.append('completed', filters.completed.toString())
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.category) params.append('category', filters.category)
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','))
      }
      if (filters.dateRange) params.append('dateRange', filters.dateRange)

      const response = await retryWithBackoff(async () => {
        return await fetch(`/api/todos/search?${params.toString()}`)
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })
      
      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }
      
      const data = await response.json()
      setTodos(data.results.map((todo: any) => safeParseTodoDate(todo)))
      
    } catch (error) {
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo検索')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`検索エラー: ${friendlyMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 手動検索関数（即座に実行）
   */
  const handleManualSearch = () => {
    searchTodos(filter)
  }

  /**
   * 基本的なクライアントサイドフィルタリング（検索結果の表示用）
   */
  useEffect(() => {
    setFilteredTodos(todos)
  }, [todos])

  /**
   * Todoの統計情報を計算
   */
  const stats: TodoStats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length,
    overdue: todos.filter(t => 
      t.dueDate && !t.completed && new Date() > t.dueDate
    ).length,
    byPriority: {
      urgent: todos.filter(t => t.priority === 'URGENT').length,
      high: todos.filter(t => t.priority === 'HIGH').length,
      medium: todos.filter(t => t.priority === 'MEDIUM').length,
      low: todos.filter(t => t.priority === 'LOW').length,
    }
  }

  /**
   * コンポーネントマウント時の初期化処理
   * Lambda関数のウォームアップも実行
   */
  useEffect(() => {
    // 初回読み込み開始
    fetchTodos()
    
    // バックグラウンドでLambda関数をウォームアップ
    warmupLambda()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400"></div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {lambdaWarmedUp ? '📊 データを読み込み中...' : '🔥 システムを準備中...'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* React Hot Toast通知システム */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 6000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      {/* パフォーマンス状態表示 */}
      {lambdaWarmedUp && (
        <div className="hidden sm:block text-xs text-green-600 dark:text-green-400 text-center">
          🚀 高速モード有効
        </div>
      )}

      {/* 統計表示 */}
      <TodoStatsDisplay stats={stats} />

      {/* Todoフォーム */}
      <TodoForm
        onSubmit={editingTodo ? handleEditSubmit : handleCreateTodo}
        onCancel={editingTodo ? () => setEditingTodo(null) : undefined}
        initialData={editingTodo || undefined}
        isLoading={isSubmitting}
      />

      {/* フィルター */}
      <TodoFiltersComponent 
        filter={filter} 
        onFilterChange={setFilter}
        onManualSearch={handleManualSearch}
        enablePersistence={true}
      />

      {/* 手動更新ボタン */}
      <div className="flex justify-center">
        <button
          onClick={() => fetchTodos(true)}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
        >
          <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
          <span>{isLoading ? '更新中...' : '最新データを取得'}</span>
        </button>
      </div>

      {/* Todoリスト */}
      <div className="space-y-4">
        {filteredTodos.length > 0 ? (
          filteredTodos.map(todo => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onUpdate={handleUpdateTodo}
              onEdit={setEditingTodo}
              onDelete={handleDeleteTodo}
              isLoading={isSubmitting}
            />
          ))
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {filter.completed !== undefined || filter.priority || filter.search ? (
              <p>🔍 条件に一致するTodoがありません</p>
            ) : (
              <p>📝 まだTodoがありません。最初のTodoを作成しましょう！</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}