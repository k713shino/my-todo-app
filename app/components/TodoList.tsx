'use client'

import { useState, useEffect } from 'react'
import { Priority } from '@prisma/client'
import { Todo, CreateTodoData, TodoStats } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
import TodoFilters from './TodoFilters'
import TodoStatsDisplay from './TodoStatsDisplay'

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

interface UpdateTodoData {
  completed?: boolean
  title?: string
  description?: string
  priority?: Priority
  dueDate?: Date | null
}

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

  // Todo一覧取得
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

  // Todo作成
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
        alert('✨ Todoが作成されました！')
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

  // Todo更新
  const handleUpdateTodo = async (id: string, data: UpdateTodoData) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        await fetchTodos()
        if (Object.keys(data).length > 1) {
          alert('✅ Todoが更新されました！')
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Todoの更新に失敗しました')
      }
    } catch (error) {
      console.error('Todo更新エラー:', error)
      alert('Todoの更新に失敗しました')
    }
  }

  // Todo削除
  const handleDeleteTodo = async (id: string) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchTodos()
        alert('🗑️ Todoが削除されました')
      } else {
        const error = await response.json()
        alert(error.error || 'Todoの削除に失敗しました')
      }
    } catch (error) {
      console.error('Todo削除エラー:', error)
      alert('Todoの削除に失敗しました')
    }
  }

  // 編集処理
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

  // フィルタリング
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

  // 統計計算
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

  // 初回読み込み
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