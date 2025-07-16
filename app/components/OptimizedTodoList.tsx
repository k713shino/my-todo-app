import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import React from 'react'
import { Priority } from '@prisma/client'
import { Todo } from '@/types/todo'

interface OptimizedTodoListProps {
  todos: Todo[]
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

// カスタムフック: デバウンス
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// カスタムフック: 効率的な仮想化スクロール
function useVirtualList<T>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = useState(0)
  
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
  )
  
  const visibleItems = items.slice(startIndex, endIndex + 1)
  const totalHeight = items.length * itemHeight
  const offsetY = startIndex * itemHeight

  return {
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    setScrollTop
  }
}

// メモ化されたTodoアイテム
const TodoItem = React.memo(({ 
  todo, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onDelete,
  style 
}: {
  todo: Todo
  isSelected: boolean
  onSelect: (selected: boolean) => void
  onUpdate: (data: Record<string, unknown>) => void
  onDelete: () => void
  style?: React.CSSProperties
}) => {
  const priorityConfig = {
    URGENT: { color: 'bg-red-100 text-red-800', icon: '🔴' },
    HIGH: { color: 'bg-orange-100 text-orange-800', icon: '🟠' },
    MEDIUM: { color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    LOW: { color: 'bg-green-100 text-green-800', icon: '🟢' }
  }

  const isOverdue = todo.dueDate && !todo.completed && new Date() > new Date(todo.dueDate)

  return (
    <div style={style} className="px-2 py-1">
      <div className={`bg-white rounded-lg shadow-md p-4 border-l-4 transition-all duration-200 hover:shadow-lg ${
        todo.completed 
          ? 'border-green-400 opacity-75' 
          : isOverdue 
          ? 'border-red-400 shadow-red-100' 
          : 'border-purple-400'
      } ${isSelected ? 'ring-2 ring-purple-300' : ''}`}>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            {/* 選択チェックボックス */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            
            {/* 完了チェックボックス */}
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={(e) => onUpdate({ completed: e.target.checked })}
              className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{priorityConfig[todo.priority].icon}</span>
                <h3 className={`font-medium truncate ${
                  todo.completed ? 'line-through text-gray-500' : 'text-gray-900'
                }`}>
                  {todo.title}
                </h3>
              </div>
              
              {todo.description && (
                <p className={`text-sm mt-1 truncate ${
                  todo.completed ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {todo.description}
                </p>
              )}
              
              {/* 期限表示 */}
              {todo.dueDate && (
                <div className={`text-xs mt-1 ${
                  isOverdue && !todo.completed 
                    ? 'text-red-600 font-medium' 
                    : 'text-gray-500'
                }`}>
                  📅 {new Date(todo.dueDate).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                  {isOverdue && !todo.completed && ' (期限切れ)'}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig[todo.priority].color}`}>
              {todo.priority}
            </span>
            
            <button
              onClick={onDelete}
              className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded"
              title="削除"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

TodoItem.displayName = 'TodoItem'

export default function OptimizedTodoList({ 
  todos, 
  onUpdate, 
  onDelete
}: OptimizedTodoListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'created' | 'priority' | 'dueDate'>('created')
  const [filter, setFilter] = useState<{
    completed?: boolean
    priority?: Priority
    overdue?: boolean
  }>({})

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight] = useState(400)

  // デバウンス検索
  const debouncedSearch = useDebounce(searchTerm, 300)

  // フィルタリング＆ソート（高度にメモ化）
  const processedTodos = useMemo(() => {
    let result = todos

    // 検索フィルター
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase()
      result = result.filter(todo => 
        todo.title.toLowerCase().includes(searchLower) ||
        todo.description?.toLowerCase().includes(searchLower)
      )
    }

    // 完了状態フィルター
    if (filter.completed !== undefined) {
      result = result.filter(todo => todo.completed === filter.completed)
    }

    // 優先度フィルター
    if (filter.priority) {
      result = result.filter(todo => todo.priority === filter.priority)
    }

    // 期限切れフィルター
    if (filter.overdue) {
      const now = new Date()
      result = result.filter(todo => 
        todo.dueDate && !todo.completed && new Date(todo.dueDate) < now
      )
    }

    // ソート
    result.sort((a, b) => {
      // 完了済みは常に下
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1
      }

      switch (sortBy) {
        case 'priority':
          const priorityOrder = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        
        default: // 'created'
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return result
  }, [todos, debouncedSearch, filter, sortBy])

  // 仮想化（500件以上で有効化）
  const useVirtualization = processedTodos.length > 500
  const ITEM_HEIGHT = 130

  const virtualization = useVirtualList(
    processedTodos,
    containerHeight,
    ITEM_HEIGHT,
    5
  )

  // バッチ操作
  const handleBatchOperation = useCallback(async (operation: 'complete' | 'delete') => {
    if (selectedTodos.size === 0) return

    const confirmMessage = operation === 'delete' 
      ? `${selectedTodos.size}個のTodoを削除しますか？`
      : `${selectedTodos.size}個のTodoを完了にしますか？`

    if (!confirm(confirmMessage)) return

    try {
      const promises = Array.from(selectedTodos).map(id => 
        operation === 'delete' 
          ? onDelete(id)
          : onUpdate(id, { completed: true })
      )
      
      await Promise.all(promises)
      setSelectedTodos(new Set())
    } catch (error) {
      console.error(`Batch ${operation} error:`, error)
      alert(`一括${operation === 'delete' ? '削除' : '完了'}に失敗しました`)
    }
  }, [selectedTodos, onUpdate, onDelete])

  // 残りのコンポーネントロジック（統計、レンダリング等）は同様に型修正...

  return (
    <div className="space-y-4">
      {/* ここに残りのJSXコンテンツ */}
    </div>
  )
}