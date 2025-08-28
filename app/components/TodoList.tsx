'use client'

import { useState, useEffect, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { Priority } from '@prisma/client'
import type { Todo, CreateTodoData, TodoStats, TodoFilters } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
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
import { withScrollPreservation } from '../hooks/useScrollPreservation'


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
// デバッグ用ページ移動監視フック
import { usePageMovementDebugger } from '@/app/hooks/usePageMovementDebugger'

interface TodoListProps {
  modalSearchValues?: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }
}

export default function TodoList({ modalSearchValues }: TodoListProps) {
  // ページ移動デバッグ開始
  usePageMovementDebugger()

  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [filter, setFilterInternal] = useState<TodoFilters>({})
  
  // ソート機能のstate
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc') // 新しい順がデフォルト
  
  // タブビューのstate
  const [activeView, setActiveView] = useState<'all' | 'status' | 'calendar' | 'kanban'>('all')
  
  // スクロール位置保持機能付きのsetFilter
  const setFilter = withScrollPreservation((newFilter: TodoFilters) => {
    console.log('🎯 setFilter実行 (スクロール保持付き):', newFilter)
    setFilterInternal(newFilter)
  })
  const [lambdaWarmedUp, setLambdaWarmedUp] = useState(false)

  // モーダルからの検索値をフィルターに反映
  useEffect(() => {
    if (modalSearchValues) {
      const newFilter: TodoFilters = {
        search: modalSearchValues.keyword || '',
        category: modalSearchValues.category || '',
        tags: modalSearchValues.tags.length > 0 ? modalSearchValues.tags : undefined,
        completed: modalSearchValues.completed,
        priority: modalSearchValues.priority as Priority | undefined,
        dateRange: (modalSearchValues.dateRange as TodoFilters['dateRange']) || undefined
      }
      
      // 空の値は除去
      Object.keys(newFilter).forEach(key => {
        const value = (newFilter as any)[key]
        if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
          delete (newFilter as any)[key]
        }
      })
      
      console.log('🔍 モーダル検索値をフィルターに反映:', newFilter)
      setFilter(newFilter)
    }
  }, [modalSearchValues])

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
   * クライアントサイドフィルタリング - シンプルで確実な動作
   */
  const applyFilters = (allTodos: Todo[], filters: TodoFilters) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 フィルター適用開始:', { 全件数: allTodos.length, フィルター: filters })
    }
    
    let filtered = [...allTodos]
    
    // テキスト検索
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim()
      filtered = filtered.filter(todo => 
        todo.title.toLowerCase().includes(searchTerm) ||
        (todo.description && todo.description.toLowerCase().includes(searchTerm))
      )
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 テキスト検索 "${searchTerm}":`, filtered.length, '件')
      }
    }
    
    // 完了状態フィルター
    if (filters.completed !== undefined) {
      filtered = filtered.filter(todo => todo.completed === filters.completed)
      console.log(`✅ 完了状態 "${filters.completed}":`, filtered.length, '件')
    }
    
    // 優先度フィルター
    if (filters.priority) {
      filtered = filtered.filter(todo => todo.priority === filters.priority)
      console.log(`⚡ 優先度 "${filters.priority}":`, filtered.length, '件')
    }
    
    // カテゴリフィルター
    if (filters.category && filters.category.trim()) {
      const categoryTerm = filters.category.toLowerCase().trim()
      filtered = filtered.filter(todo => 
        todo.category && todo.category.toLowerCase().includes(categoryTerm)
      )
      console.log(`📂 カテゴリ "${filters.category}":`, filtered.length, '件')
    }
    
    // タグフィルター
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(todo => {
        const todoTags = todo.tags || []
        return filters.tags!.some(tag => todoTags.includes(tag))
      })
      console.log(`🏷️ タグ "${filters.tags.join(',')}":`, filtered.length, '件')
    }
    
    // 日付範囲フィルター
    if (filters.dateRange) {
      const now = new Date()
      
      if (filters.dateRange === 'overdue') {
        // 期限切れ：期限が過去で未完了
        filtered = filtered.filter(todo => 
          todo.dueDate && new Date(todo.dueDate) < now && !todo.completed
        )
      } else if (filters.dateRange === 'today') {
        // 今日：今日が期限
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= todayStart && dueDate < todayEnd
        })
      } else if (filters.dateRange === 'tomorrow') {
        // 明日：明日が期限
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= tomorrowStart && dueDate < tomorrowEnd
        })
      } else if (filters.dateRange === 'this_week') {
        // 今週：今週中が期限
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay()) // 今週の日曜日
        weekStart.setHours(0, 0, 0, 0)
        
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7) // 来週の日曜日
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= weekStart && dueDate < weekEnd
        })
      } else if (filters.dateRange === 'next_week') {
        // 来週：来週中が期限
        const nextWeekStart = new Date(now)
        nextWeekStart.setDate(now.getDate() - now.getDay() + 7) // 来週の日曜日
        nextWeekStart.setHours(0, 0, 0, 0)
        
        const nextWeekEnd = new Date(nextWeekStart)
        nextWeekEnd.setDate(nextWeekStart.getDate() + 7) // 再来週の日曜日
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextWeekStart && dueDate < nextWeekEnd
        })
      } else if (filters.dateRange === 'this_month') {
        // 今月：今月中が期限
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= monthStart && dueDate < monthEnd
        })
      } else if (filters.dateRange === 'next_month') {
        // 来月：来月中が期限
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextMonthStart && dueDate < nextMonthEnd
        })
      } else if (filters.dateRange === 'no_due_date') {
        // 期限なし：期限が設定されていない
        filtered = filtered.filter(todo => !todo.dueDate)
      }
      console.log(`📅 日付範囲 "${filters.dateRange}":`, filtered.length, '件')
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ フィルター適用完了:', filtered.length, '件')
    }
    return filtered
  }

  /**
   * 手動検索関数（即座に実行）
   * 現在はuseMemoで自動的にフィルタリングされるため、フォーカスのみ制御
   */
  const handleManualSearch = () => {
    console.log('🔍 手動検索実行:', filter)
    console.log('🔄 現在のフィルター済みTodos:', filteredTodos.length, '件')
    // フィルタリングはuseMemoで自動実行されるため、UI更新は不要
    // 必要に応じてフォーカス制御などのUI操作のみ実行
  }

  /**
   * ソート機能
   */
  const sortTodos = (todosToSort: Todo[]) => {
    const sorted = [...todosToSort].sort((a, b) => {
      // 「すべて」タブでは未完了を優先表示
      if (activeView === 'all') {
        // 完了状態が異なる場合は未完了を先に
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1
        }
      }

      let comparison = 0

      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'dueDate':
          // 期限なしのTodoは最後に表示
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case 'priority':
          const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return sorted
  }

  /**
   * 基本的なクライアントサイドフィルタリング（検索結果の表示用）
   * useMemoを使用して不要な再計算とDOM操作を防止
   */
  const filteredTodos = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 todos, filter, または sort設定 変更検知 (useMemo)')
    }
    const filtered = applyFilters(todos, filter)
    const sorted = sortTodos(filtered)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 フィルター・ソート結果:', { 入力件数: todos.length, 出力件数: sorted.length, ソート: `${sortBy} ${sortOrder}`, activeView })
    }
    return sorted
  }, [todos, filter, sortBy, sortOrder, activeView])

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
  }, [])

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

      {/* Todo統計表示 */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">合計</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.active}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">未完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">期限切れ</div>
          </div>
        </div>
      </div>

      {/* Notionライクなタブビュー */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* タブヘッダー */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'all', label: '📋 すべて', icon: '📋' },
            { id: 'status', label: '📊 ステータス別', icon: '📊' },
            { id: 'calendar', label: '📅 カレンダー', icon: '📅' },
            { id: 'kanban', label: '🗂️ かんばん', icon: '🗂️' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as typeof activeView)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeView === view.id
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-base">{view.icon}</span>
                <span className="hidden sm:inline">{view.label.split(' ')[1]}</span>
              </span>
              {activeView === view.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"></div>
              )}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="p-4">
          {activeView === 'all' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  📋 全てのタスク
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* ソート項目選択 */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">並び順:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'dueDate' | 'priority')}
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="createdAt">📅 作成日時</option>
                      <option value="dueDate">⏰ 期限日</option>
                      <option value="priority">⚡ 優先度</option>
                    </select>
                  </div>
                  
                  {/* 昇順/降順切り替え */}
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-xs px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                  >
                    {sortOrder === 'desc' ? (
                      <>🔽 新しい順</>
                    ) : (
                      <>🔼 古い順</>
                    )}
                  </button>
                </div>
              </div>
              
              {/* 現在のソート状況表示 */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {filteredTodos.length}件のTodoを
                {sortBy === 'createdAt' && '作成日時'}
                {sortBy === 'dueDate' && '期限日'}
                {sortBy === 'priority' && '優先度'}
                の{sortOrder === 'desc' ? '降順' : '昇順'}で表示
              </div>
            </div>
          )}

          {activeView === 'status' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                📊 ステータス別表示
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 未完了タスク */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
                    ⏳ 未完了 ({filteredTodos.filter(t => !t.completed).length}件)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredTodos.filter(t => !t.completed).slice(0, 5).map(todo => (
                      <div key={todo.id} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                        <div className="font-medium">{todo.title}</div>
                        {todo.dueDate && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            期限: {new Date(todo.dueDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredTodos.filter(t => !t.completed).length > 5 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        ...他{filteredTodos.filter(t => !t.completed).length - 5}件
                      </div>
                    )}
                  </div>
                </div>

                {/* 完了タスク */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
                    ✅ 完了 ({filteredTodos.filter(t => t.completed).length}件)
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredTodos.filter(t => t.completed).slice(0, 5).map(todo => (
                      <div key={todo.id} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                        <div className="font-medium line-through opacity-75">{todo.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          完了日: {new Date(todo.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                    {filteredTodos.filter(t => t.completed).length > 5 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        ...他{filteredTodos.filter(t => t.completed).length - 5}件
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                📅 カレンダー表示
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* 今日 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-3">
                    📅 今日
                  </h4>
                  <div className="space-y-2">
                    {filteredTodos
                      .filter(todo => {
                        if (!todo.dueDate) return false
                        const today = new Date()
                        const dueDate = new Date(todo.dueDate)
                        return dueDate.toDateString() === today.toDateString()
                      })
                      .map(todo => (
                        <div key={todo.id} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                          <div className={`font-medium ${todo.completed ? 'line-through opacity-75' : ''}`}>
                            {todo.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            優先度: {todo.priority}
                          </div>
                        </div>
                      ))
                    }
                    {filteredTodos.filter(todo => {
                      if (!todo.dueDate) return false
                      const today = new Date()
                      const dueDate = new Date(todo.dueDate)
                      return dueDate.toDateString() === today.toDateString()
                    }).length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        今日のタスクはありません
                      </div>
                    )}
                  </div>
                </div>

                {/* 明日 */}
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-3">
                    📅 明日
                  </h4>
                  <div className="space-y-2">
                    {filteredTodos
                      .filter(todo => {
                        if (!todo.dueDate) return false
                        const tomorrow = new Date()
                        tomorrow.setDate(tomorrow.getDate() + 1)
                        const dueDate = new Date(todo.dueDate)
                        return dueDate.toDateString() === tomorrow.toDateString()
                      })
                      .map(todo => (
                        <div key={todo.id} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-700">
                          <div className={`font-medium ${todo.completed ? 'line-through opacity-75' : ''}`}>
                            {todo.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            優先度: {todo.priority}
                          </div>
                        </div>
                      ))
                    }
                    {filteredTodos.filter(todo => {
                      if (!todo.dueDate) return false
                      const tomorrow = new Date()
                      tomorrow.setDate(tomorrow.getDate() + 1)
                      const dueDate = new Date(todo.dueDate)
                      return dueDate.toDateString() === tomorrow.toDateString()
                    }).length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        明日のタスクはありません
                      </div>
                    )}
                  </div>
                </div>

                {/* 期限切れ */}
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-3">
                    ⚠️ 期限切れ
                  </h4>
                  <div className="space-y-2">
                    {filteredTodos
                      .filter(todo => {
                        if (!todo.dueDate || todo.completed) return false
                        const now = new Date()
                        const dueDate = new Date(todo.dueDate)
                        return dueDate < now
                      })
                      .map(todo => (
                        <div key={todo.id} className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
                          <div className="font-medium text-red-600 dark:text-red-400">
                            {todo.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            期限: {new Date(todo.dueDate!).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    }
                    {filteredTodos.filter(todo => {
                      if (!todo.dueDate || todo.completed) return false
                      const now = new Date()
                      const dueDate = new Date(todo.dueDate)
                      return dueDate < now
                    }).length === 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        期限切れのタスクはありません
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'kanban' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                🗂️ かんばんボード
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 優先度別かんばん */}
                {[
                  { priority: 'URGENT', label: '🚨 緊急', color: 'red' },
                  { priority: 'HIGH', label: '🔥 高', color: 'orange' },
                  { priority: 'MEDIUM', label: '⚡ 中', color: 'yellow' },
                  { priority: 'LOW', label: '📝 低', color: 'green' },
                ].map(({ priority, label, color }) => (
                  <div key={priority} className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg p-4`}>
                    <h4 className={`font-medium text-${color}-800 dark:text-${color}-200 mb-3 flex items-center gap-2`}>
                      {label} ({filteredTodos.filter(t => t.priority === priority).length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredTodos
                        .filter(t => t.priority === priority)
                        .map(todo => (
                          <div 
                            key={todo.id} 
                            className={`text-sm p-3 bg-white dark:bg-gray-800 rounded-md border border-${color}-200 dark:border-${color}-700 cursor-pointer hover:shadow-sm transition-shadow`}
                            onClick={() => setEditingTodo(todo)}
                          >
                            <div className={`font-medium ${todo.completed ? 'line-through opacity-75' : ''}`}>
                              {todo.title}
                            </div>
                            {todo.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                {todo.description}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              <div className={`text-xs px-2 py-1 rounded-full ${
                                todo.completed 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {todo.completed ? '✅ 完了' : '⏳ 作業中'}
                              </div>
                              {todo.dueDate && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(todo.dueDate).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TodoフォームとTodoリスト */}
      {editingTodo ? (
        <TodoForm
          onSubmit={handleEditSubmit}
          isLoading={isSubmitting}
          initialData={{
            title: editingTodo.title,
            description: editingTodo.description || '',
            priority: editingTodo.priority,
            dueDate: editingTodo.dueDate,
            category: editingTodo.category,
            tags: editingTodo.tags,
          }}
          onCancel={() => setEditingTodo(null)}
        />
      ) : (
        <TodoForm
          onSubmit={handleCreateTodo}
          isLoading={isSubmitting}
        />
      )}


      {/* フィルター済みTodoリスト表示（「すべて」タブでのみ表示） */}
      {activeView === 'all' && (
        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {todos.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-4xl">📝</div>
                  <div>まだTodoがありません。最初のTodoを作成してみましょう！</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">🔍</div>
                  <div>検索条件に一致するTodoが見つかりませんでした。</div>
                  <div className="text-sm">フィルター条件を変更してみてください。</div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {todos.length}件中 {filteredTodos.length}件を表示
                </p>
                {/* <button 
                  onClick={() => fetchTodos(true)}
                  className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                >
                  🔄 再読み込み
                </button> */}
              </div>
{(() => {
                const incompleteTodos = filteredTodos.filter(todo => !todo.completed)
                const completedTodos = filteredTodos.filter(todo => todo.completed)
                
                return (
                  <>
                    {/* 未完了タスク */}
                    {incompleteTodos.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>未完了のタスク ({incompleteTodos.length}件)</span>
                        </div>
                        {incompleteTodos.map((todo) => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onUpdate={handleUpdateTodo}
                            onDelete={handleDeleteTodo}
                            onEdit={setEditingTodo}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* 完了タスク */}
                    {completedTodos.length > 0 && (
                      <div className="space-y-3 mt-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>完了したタスク ({completedTodos.length}件)</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-4"></div>
                        </div>
                        {completedTodos.map((todo) => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onUpdate={handleUpdateTodo}
                            onDelete={handleDeleteTodo}
                            onEdit={setEditingTodo}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
