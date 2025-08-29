'use client'

import { useState, useEffect } from 'react'
import { Todo, CreateTodoData } from '@/types/todo'
import { Priority, Status } from '@prisma/client'
import { toast } from 'react-hot-toast'

interface SubtaskManagerProps {
  parentTodo: Todo
  onClose: () => void
  onSubtaskChange: () => void
}

export default function SubtaskManager({ parentTodo, onClose, onSubtaskChange }: SubtaskManagerProps) {
  const [subtasks, setSubtasks] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // サブタスク取得
  const fetchSubtasks = async () => {
    try {
      const response = await fetch(`/api/todos/${parentTodo.id}/subtasks`)
      if (!response.ok) throw new Error('Failed to fetch subtasks')
      
      const data = await response.json()
      setSubtasks(data)
    } catch (error) {
      console.error('サブタスク取得エラー:', error)
      toast.error('サブタスクの取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  // サブタスク作成
  const createSubtask = async () => {
    if (!newSubtaskTitle.trim()) return

    setIsCreating(true)
    try {
      const subtaskData: CreateTodoData = {
        title: newSubtaskTitle.trim(),
        status: 'TODO',
        priority: 'MEDIUM'
      }

      const response = await fetch(`/api/todos/${parentTodo.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subtaskData)
      })

      if (!response.ok) throw new Error('Failed to create subtask')

      const newSubtask = await response.json()
      setSubtasks(prev => [...prev, newSubtask])
      setNewSubtaskTitle('')
      onSubtaskChange()
      toast.success('サブタスクを作成しました')
    } catch (error) {
      console.error('サブタスク作成エラー:', error)
      toast.error('サブタスクの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  // サブタスク更新
  const updateSubtask = async (subtaskId: string, updates: { status?: Status }) => {
    try {
      const response = await fetch(`/api/todos/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!response.ok) throw new Error('Failed to update subtask')

      const updatedSubtask = await response.json()
      setSubtasks(prev => prev.map(s => s.id === subtaskId ? updatedSubtask : s))
      onSubtaskChange()
      toast.success('サブタスクを更新しました')
    } catch (error) {
      console.error('サブタスク更新エラー:', error)
      toast.error('サブタスクの更新に失敗しました')
    }
  }

  // サブタスク削除
  const deleteSubtask = async (subtaskId: string) => {
    if (!confirm('このサブタスクを削除しますか？')) return

    try {
      const response = await fetch(`/api/todos/${subtaskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete subtask')

      setSubtasks(prev => prev.filter(s => s.id !== subtaskId))
      onSubtaskChange()
      toast.success('サブタスクを削除しました')
    } catch (error) {
      console.error('サブタスク削除エラー:', error)
      toast.error('サブタスクの削除に失敗しました')
    }
  }

  const getNextStatus = (currentStatus: Status): Status => {
    switch (currentStatus) {
      case 'TODO': return 'IN_PROGRESS'
      case 'IN_PROGRESS': return 'REVIEW'
      case 'REVIEW': return 'DONE'
      case 'DONE': return 'TODO'
      default: return 'TODO'
    }
  }

  const getStatusColor = (status: Status) => {
    switch (status) {
      case 'TODO': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
      case 'REVIEW': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
      case 'DONE': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
    }
  }

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case 'TODO': return '📝'
      case 'IN_PROGRESS': return '🔄'
      case 'REVIEW': return '👀'
      case 'DONE': return '✅'
    }
  }

  useEffect(() => {
    fetchSubtasks()
  }, [parentTodo.id])

  const completedCount = subtasks.filter(s => s.status === 'DONE').length
  const progressPercentage = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                📋 サブタスク管理
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {parentTodo.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          {/* 進捗表示 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">進捗状況</span>
              <span className="font-medium">
                {completedCount} / {subtasks.length} 完了 ({progressPercentage.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* サブタスク追加フォーム */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                placeholder="新しいサブタスクを入力..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && createSubtask()}
              />
              <button
                onClick={createSubtask}
                disabled={isCreating || !newSubtaskTitle.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? '作成中...' : '追加'}
              </button>
            </div>
          </div>

          {/* サブタスクリスト */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">読み込み中...</p>
            </div>
          ) : subtasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>まだサブタスクがありません</p>
              <p className="text-sm mt-1">上のフォームから追加してください</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className={`font-medium ${
                        subtask.status === 'DONE' 
                          ? 'line-through text-gray-500 dark:text-gray-400' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {subtask.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => updateSubtask(subtask.id, { status: getNextStatus(subtask.status) })}
                        className={`px-2 py-1 text-xs rounded-full font-medium ${getStatusColor(subtask.status)}`}
                      >
                        {getStatusIcon(subtask.status)} {subtask.status === 'DONE' ? '完了' : subtask.status === 'IN_PROGRESS' ? '作業中' : subtask.status === 'REVIEW' ? '確認中' : '未着手'}
                      </button>
                      <button
                        onClick={() => deleteSubtask(subtask.id)}
                        className="text-red-600 hover:text-red-800 text-xs p-1"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}