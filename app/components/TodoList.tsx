'use client'

import { useState, useEffect } from 'react'
import { Priority } from '@prisma/client'
import { Todo, CreateTodoData, TodoStats } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
import TodoFilters from './TodoFilters'
import TodoStatsDisplay from './TodoStatsDisplay'
import RealtimeUpdates from './RealtimeUpdates'
import { Toaster } from 'react-hot-toast'

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
  const [filter, setFilter] = useState<{
    completed?: boolean
    priority?: Priority
    search?: string
  }>({})

  /**
   * サーバーからTodo一覧を取得
   * 取得したデータの日付文字列をDateオブジェクトに変換
   */
  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos')
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
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchTodos()
      } else {
        const error = await response.json()
        alert(error.error || 'Todoの作成に失敗しました')
      }
    } catch (error) {
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
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchTodos()
      } else {
        const error = await response.json()
        alert(error.error || 'Todoの更新に失敗しました')
      }
    } catch (error) {
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
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchTodos()
      } else {
        const error = await response.json()
        alert(error.error || 'Todoの削除に失敗しました')
      }
    } catch (error) {
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
   * WebSocketによるリアルタイム更新ハンドラー群
   * - 他ユーザーによる更新をリアルタイムに反映
   * - 更新、作成、削除それぞれに対応
   */
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

  /**
   * Todoリストのフィルタリング処理
   * - 完了状態でフィルタリング
   * - 優先度でフィルタリング
   * - タイトルと説明文で検索
   * - フィルター条件やTodo一覧が変更される度に再計算
   */
  useEffect(() => {
    let filtered = todos

    if (filter.completed !== undefined) {
      filtered = filtered.filter(todo => todo.completed === filter.completed)
    }

    if (filter.priority) {
      filtered = filtered.filter(todo => todo.priority === filter.priority)
    }

    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      filtered = filtered.filter(todo => 
        todo.title.toLowerCase().includes(searchLower) ||
        todo.description?.toLowerCase().includes(searchLower)
      )
    }

    setFilteredTodos(filtered)
  }, [todos, filter])

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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

      {/* リアルタイム更新コンポーネント */}
      <RealtimeUpdates
        onTodoUpdate={handleRealtimeUpdate}
        onTodoCreate={handleRealtimeCreate}
        onTodoDelete={handleRealtimeDelete}
      />

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
      <TodoFilters filter={filter} onFilterChange={setFilter} />

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
          <div className="text-center py-12 text-gray-500">
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