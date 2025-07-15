'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import React from 'react'
import { Priority } from '@prisma/client'
import { Todo } from '@/types/todo'

interface OptimizedTodoListProps {
  todos: Todo[]
  onUpdate: (id: string, data: any) => void
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
  onUpdate: (data: any) => void
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
  onDelete, 
  isLoading = false 
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
  const [containerHeight, setContainerHeight] = useState(400)

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

  // 選択操作
  const handleSelectAll = useCallback(() => {
    if (selectedTodos.size === processedTodos.length) {
      setSelectedTodos(new Set())
    } else {
      setSelectedTodos(new Set(processedTodos.map(todo => todo.id)))
    }
  }, [selectedTodos.size, processedTodos])

  const handleTodoSelect = useCallback((todoId: string, selected: boolean) => {
    setSelectedTodos(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(todoId)
      } else {
        newSet.delete(todoId)
      }
      return newSet
    })
  }, [])

  // 統計計算
  const stats = useMemo(() => ({
    total: processedTodos.length,
    completed: processedTodos.filter(t => t.completed).length,
    overdue: processedTodos.filter(t => 
      t.dueDate && !t.completed && new Date() > new Date(t.dueDate)
    ).length,
    urgent: processedTodos.filter(t => t.priority === 'URGENT' && !t.completed).length
  }), [processedTodos])

  return (
    <div className="space-y-4">
      {/* 統計サマリー */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm opacity-90">総数</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-300">{stats.completed}</div>
            <div className="text-sm opacity-90">完了</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-300">{stats.overdue}</div>
            <div className="text-sm opacity-90">期限切れ</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-300">{stats.urgent}</div>
            <div className="text-sm opacity-90">緊急</div>
          </div>
        </div>
      </div>

      {/* 検索・フィルター・ソート */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 検索 */}
          <input
            type="text"
            placeholder="🔍 Todoを検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          
          {/* 完了状態フィルター */}
          <select
            value={filter.completed === undefined ? '' : filter.completed.toString()}
            onChange={(e) => setFilter(prev => ({
              ...prev,
              completed: e.target.value === '' ? undefined : e.target.value === 'true'
            }))}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="">すべての状態</option>
            <option value="false">未完了のみ</option>
            <option value="true">完了済みのみ</option>
          </select>
          
          {/* 優先度フィルター */}
          <select
            value={filter.priority || ''}
            onChange={(e) => setFilter(prev => ({
              ...prev,
              priority: e.target.value as Priority || undefined
            }))}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="">すべての優先度</option>
            <option value="URGENT">🔴 緊急</option>
            <option value="HIGH">🟠 高</option>
            <option value="MEDIUM">🟡 中</option>
            <option value="LOW">🟢 低</option>
          </select>
          
          {/* ソート */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500"
          >
            <option value="created">作成日順</option>
            <option value="priority">優先度順</option>
            <option value="dueDate">期限順</option>
          </select>
        </div>

        {/* クイックフィルター */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter({ completed: false })}
            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm hover:bg-blue-200 transition-colors"
          >
            📝 未完了
          </button>
          <button
            onClick={() => setFilter({ overdue: true })}
            className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200 transition-colors"
          >
            ⏰ 期限切れ
          </button>
          <button
            onClick={() => setFilter({ priority: 'URGENT' })}
            className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm hover:bg-red-200 transition-colors"
          >
            🔴 緊急
          </button>
          <button
            onClick={() => setFilter({})}
            className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm hover:bg-gray-200 transition-colors"
          >
            ✨ すべて
          </button>
        </div>

        {/* 選択・バッチ操作 */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
            >
              {selectedTodos.size === processedTodos.length ? '✅ 全解除' : '☐ 全選択'}
            </button>
            <span className="text-sm text-gray-600">
              表示: {processedTodos.length}件 / 総数: {todos.length}件
            </span>
          </div>
          
          {selectedTodos.size > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 font-medium">
                {selectedTodos.size}個選択中
              </span>
              <button
                onClick={() => handleBatchOperation('complete')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
              >
                ✅ 一括完了
              </button>
              <button
                onClick={() => handleBatchOperation('delete')}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
              >
                🗑️ 一括削除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Todoリスト */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {processedTodos.length > 0 ? (
          <div 
            ref={containerRef}
            className="relative"
            style={{ height: containerHeight }}
          >
            {useVirtualization ? (
              // 仮想化リスト（500件以上）
              <div 
                className="overflow-auto h-full"
                onScroll={(e) => virtualization.setScrollTop(e.currentTarget.scrollTop)}
              >
                <div style={{ height: virtualization.totalHeight, position: 'relative' }}>
                  <div 
                    className="absolute inset-x-0"
                    style={{ 
                      transform: `translateY(${virtualization.offsetY}px)`,
                      top: 0
                    }}
                  >
                    {virtualization.visibleItems.map((todo, index) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        isSelected={selectedTodos.has(todo.id)}
                        onSelect={(selected) => handleTodoSelect(todo.id, selected)}
                        onUpdate={(data) => onUpdate(todo.id, data)}
                        onDelete={() => onDelete(todo.id)}
                        style={{ height: ITEM_HEIGHT }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // 通常リスト（500件未満）
              <div className="overflow-y-auto h-full">
                {processedTodos.map((todo) => (
                  <TodoItem
                    key={todo.id}
                    todo={todo}
                    isSelected={selectedTodos.has(todo.id)}
                    onSelect={(selected) => handleTodoSelect(todo.id, selected)}
                    onUpdate={(data) => onUpdate(todo.id, data)}
                    onDelete={() => onDelete(todo.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            {debouncedSearch || Object.keys(filter).length > 0 ? (
              <div>
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-lg">条件に一致するTodoがありません</p>
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilter({})
                  }}
                  className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  フィルターをリセット
                </button>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-4">📝</div>
                <p className="text-lg">まだTodoがありません</p>
                <p className="text-sm text-gray-400 mt-2">最初のTodoを作成してみましょう！</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* パフォーマンス情報（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 text-center space-x-4">
          <span>レンダリングモード: {useVirtualization ? '仮想化' : '通常'}</span>
          {useVirtualization && (
            <span>
              表示範囲: {virtualization.startIndex + 1}-{virtualization.endIndex + 1} / {processedTodos.length}件
            </span>
          )}
          <span>選択中: {selectedTodos.size}件</span>
        </div>
      )}
    </div>
  )
}