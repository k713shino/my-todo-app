'use client'

import { useState } from 'react'
import { format, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Priority } from '@prisma/client'
import { Todo } from '@/types/todo'

interface TodoItemProps {
  todo: Todo
  onUpdate: (id: string, data: { completed?: boolean }) => void
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => void
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

const priorityIcons = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  URGENT: '🔴',
}

export default function TodoItem({ 
  todo, 
  onUpdate, 
  onEdit, 
  onDelete, 
  isLoading = false 
}: TodoItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const isOverdue = todo.dueDate && !todo.completed && 
    isAfter(new Date(), new Date(todo.dueDate))

  const handleToggleComplete = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(todo.id, { completed: !todo.completed })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = () => {
    if (confirm(`「${todo.title}」を削除してもよろしいですか？`)) {
      onDelete(todo.id)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 transition-all duration-200 ${
      todo.completed 
        ? 'border-green-400 opacity-75' 
        : isOverdue 
        ? 'border-red-400' 
        : 'border-purple-400'
    } ${isUpdating ? 'opacity-50' : ''}`}>
      
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-3 flex-1">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={handleToggleComplete}
            disabled={isLoading || isUpdating}
            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
          />
          <h3 className={`text-lg font-medium ${
            todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
          }`}>
            {priorityIcons[todo.priority]} {todo.title}
          </h3>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(todo)}
            disabled={isLoading}
            className="text-gray-400 hover:text-purple-600 transition-colors"
            title="編集"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="text-gray-400 hover:text-red-600 transition-colors"
            title="削除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 説明 */}
      {todo.description && (
        <p className={`text-sm mb-3 ${
          todo.completed ? 'text-gray-400' : 'text-gray-600'
        }`}>
          {todo.description}
        </p>
      )}

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {/* 優先度 */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[todo.priority]}`}>
          {priorityLabels[todo.priority]}
        </span>

        {/* 期限 */}
        {todo.dueDate && (
          <span className={`text-xs ${
            isOverdue && !todo.completed 
              ? 'text-red-600 font-medium' 
              : todo.completed 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            📅 {format(new Date(todo.dueDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
            {isOverdue && !todo.completed && ' (期限切れ)'}
          </span>
        )}

        {/* 作成日 */}
        <span className="text-xs text-gray-400">
          作成: {format(new Date(todo.createdAt), 'M月d日 HH:mm', { locale: ja })}
        </span>
      </div>
    </div>
  )
}
