'use client'

import { useState } from 'react'
import { Priority } from '@prisma/client'
import { format } from 'date-fns'

interface TodoFormProps {
  onSubmit: (data: {
    title: string
    description?: string
    priority: Priority
    dueDate?: Date
  }) => void
  onCancel?: () => void
  initialData?: {
    title?: string
    description?: string | null | undefined 
    priority?: Priority
    dueDate?: Date | null
  }
  isLoading?: boolean
}

const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

const priorityColors = {
  LOW: 'text-green-600 bg-green-100',
  MEDIUM: 'text-yellow-600 bg-yellow-100',
  HIGH: 'text-orange-600 bg-orange-100',
  URGENT: 'text-red-600 bg-red-100',
}

export default function TodoForm({ 
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading = false 
}: TodoFormProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState<Priority>(initialData?.priority || 'MEDIUM')
  const [dueDate, setDueDate] = useState(
    initialData?.dueDate ? format(initialData.dueDate, 'yyyy-MM-dd\'T\'HH:mm') : ''
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      alert('タイトルを入力してください')
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate ? new Date(dueDate) : undefined,
    })

    // リセット（新規作成時のみ）
    if (!initialData) {
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setDueDate('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">
        {initialData ? '✏️ Todoを編集' : '✨ 新しいTodoを作成'}
      </h3>

      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          タイトル *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="何をしますか？"
          required
          disabled={isLoading}
        />
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          説明
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="詳細を入力してください（任意）"
          rows={3}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            優先度
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 期限 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            期限
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            disabled={isLoading}
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading || !title.trim()}
        >
          {isLoading ? '保存中...' : (initialData ? '更新' : '作成')}
        </button>
      </div>
    </form>
  )
}
