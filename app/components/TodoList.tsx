'use client'

import { useState, useEffect, useCallback } from 'react'
import { Priority } from '@prisma/client'
import type { Todo, CreateTodoData, TodoStats, TodoFilters } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
import TodoFiltersComponent from './TodoFilters'
import TodoStatsDisplay from './TodoStatsDisplay'
// import RealtimeUpdates from './RealtimeUpdates'
import { Toaster, toast } from 'react-hot-toast'


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

  /**
   * サーバーからTodo一覧を取得
   * 取得したデータの日付文字列をDateオブジェクトに変換
   */
  const fetchTodos = async (bypassCache = false) => {
    try {
      // キャッシュバスター用のタイムスタンプを追加
      const timestamp = Date.now()
      const url = bypassCache 
        ? `/api/todos?cache=false&_t=${timestamp}` 
        : `/api/todos?_t=${timestamp}`
      
      const response = await fetch(url, {
        // キャッシュを無効化
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data: TodoResponse[] = await response.json()
        setTodos(data.map((todo) => ({
          ...todo,
          createdAt: new Date(todo.createdAt),
          updatedAt: new Date(todo.updatedAt),
          dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
        })))
      }
    } catch (error) {
      console.error('Todo取得エラー:', error)
      alert('Todoの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * 新規Todoの作成
   * @param data 作成するTodoのデータ
   * - 作成中は送信ボタンを無効化
   * - エラー時はユーザーに通知
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
      userId: 'current-user'
    }
    
    // UIを即座に更新
    setTodos(prev => [optimisticTodo, ...prev])
    
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const newTodo: TodoResponse = await response.json()
        // 一時的なTodoを実際のTodoで置き換え
        setTodos(prev => prev.map(todo => 
          todo.id === tempId 
            ? {
                ...newTodo,
                createdAt: new Date(newTodo.createdAt),
                updatedAt: new Date(newTodo.updatedAt),
                dueDate: newTodo.dueDate ? new Date(newTodo.dueDate) : null,
              }
            : todo
        ))
        toast.success('📝 新しいTodoを作成しました！')
        
        // 最新データを再読み込み（キャッシュ無効化対応）
        setTimeout(() => fetchTodos(true), 100)
      } else {
        // エラー時は楽観的更新を取り消し
        setTodos(prev => prev.filter(todo => todo.id !== tempId))
        const error = await response.json()
        alert(error.error || 'Todoの作成に失敗しました')
      }
    } catch (error) {
      // エラー時は楽観的更新を取り消し
      setTodos(prev => prev.filter(todo => todo.id !== tempId))
      console.error('Todo作成エラー:', error)
      alert('Todoの作成に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Todoの更新
   * @param id 更新対象のTodoID
   * @param data 更新するデータ（部分更新可能）
   * - 更新後は一覧を再取得して表示を更新
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
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        const updatedTodo: TodoResponse = await response.json()
        // 実際のレスポンスでUIを更新
        setTodos(prev => prev.map(todo => 
          todo.id === id 
            ? {
                ...updatedTodo,
                createdAt: new Date(updatedTodo.createdAt),
                updatedAt: new Date(updatedTodo.updatedAt),
                dueDate: updatedTodo.dueDate ? new Date(updatedTodo.dueDate) : null,
              }
            : todo
        ))
        toast.success('✅ Todoを更新しました！')
        
        // 最新データを再読み込み（キャッシュ無効化対応）
        setTimeout(() => fetchTodos(true), 100)
      } else {
        // エラー時は元の状態に戻す
        setTodos(originalTodos)
        const error = await response.json()
        toast.error(error.error || 'Todoの更新に失敗しました')
      }
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      console.error('Todo更新エラー:', error)
      alert('Todoの更新に失敗しました')
    }
  }

  /**
   * Todoの削除
   * @param id 削除対象のTodoID
   * - 削除後は一覧を再取得
   * - エラー時はユーザーに通知
   */
  const handleDeleteTodo = async (id: string) => {
    // 楽観的UI更新：即座にUIから削除
    const originalTodos = todos
    setTodos(prev => prev.filter(todo => todo.id !== id))
    
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('🗑️ Todoを削除しました！')
        
        // 最新データを再読み込み（キャッシュ無効化対応）
        setTimeout(() => fetchTodos(true), 100)
      } else {
        // エラー時は元の状態に戻す
        setTodos(originalTodos)
        const error = await response.json()
        alert(error.error || 'Todoの削除に失敗しました')
      }
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      console.error('Todo削除エラー:', error)
      alert('Todoの削除に失敗しました')
    }
  }

  /**
   * Todo編集フォームの送信処理
   * @param data 編集後のTodoデータ
   * - 編集中は送信ボタンを無効化
   * - 更新完了後は編集モードを解除
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
   * WebSocketによるリアルタイム更新ハンドラー群（一時的に無効化）
   * - 他ユーザーによる更新をリアルタイムに反映
   * - 更新、作成、削除それぞれに対応
   */
  /*
  const handleRealtimeUpdate = (updatedTodo: Todo) => {
    setTodos(prev => prev.map(todo => 
      todo.id === updatedTodo.id ? updatedTodo : todo
    ))
  }

  const handleRealtimeCreate = (newTodo: Todo) => {
    setTodos(prev => [newTodo, ...prev])
  }

  const handleRealtimeDelete = (todoId: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== todoId))
  }
  */

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

      const response = await fetch(`/api/todos/search?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setTodos(data.results.map((todo: any) => ({
          ...todo,
          createdAt: new Date(todo.createdAt),
          updatedAt: new Date(todo.updatedAt),
          dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
        })))
      }
    } catch (error) {
      console.error('検索エラー:', error)
      toast.error('検索に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }


  /**
   * フィルター条件変更時の処理（手動検索のみ）
   * 自動検索は無効化し、手動検索ボタンクリック時のみ検索実行
   */
  // useEffect(() => {
  //   debouncedSearchTodos(filter)
  // }, [filter, debouncedSearchTodos])

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
   * - 全体の件数
   * - 完了・未完了の件数
   * - 期限切れの件数
   * - 優先度ごとの件数
   */
  const stats: TodoStats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length,
    overdue: todos.filter(t => 
      t.dueDate && !t.completed && new Date() > new Date(t.dueDate)
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
   * - Todo一覧の初回読み込みを実行
   */
  useEffect(() => {
    fetchTodos()
  }, [])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* React Hot Toast通知システム */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />

      {/* リアルタイム更新コンポーネント（一時的に無効化） */}
      {/* <RealtimeUpdates
        onTodoUpdate={handleRealtimeUpdate}
        onTodoCreate={handleRealtimeCreate}
        onTodoDelete={handleRealtimeDelete}
      /> */}

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