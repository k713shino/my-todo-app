'use client'

import { Priority } from '@prisma/client'

interface TodoFiltersProps {
  filter: {
    completed?: boolean
    priority?: Priority
    search?: string
  }
  onFilterChange: (filter: {
    completed?: boolean
    priority?: Priority
    search?: string
  }) => void
}

const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

export default function TodoFilters({ filter, onFilterChange }: TodoFiltersProps) {
  const handleCompletedFilter = (completed?: boolean) => {
    onFilterChange({ ...filter, completed })
  }

  const handlePriorityFilter = (priority?: Priority) => {
    onFilterChange({ ...filter, priority })
  }

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filter, search: search || undefined })
  }

  const clearFilters = () => {
    onFilterChange({})
  }

  const hasActiveFilters = filter.completed !== undefined || filter.priority || filter.search

  return (
    <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">🔍 フィルター</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-purple-600 hover:text-purple-800 transition-colors"
          >
            すべてクリア
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 検索 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            検索
          </label>
          <input
            type="text"
            value={filter.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="タイトルや説明で検索..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* 完了状態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            完了状態
          </label>
          <select
            value={filter.completed === undefined ? '' : filter.completed.toString()}
            onChange={(e) => {
              const value = e.target.value
              handleCompletedFilter(
                value === '' ? undefined : value === 'true'
              )
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="false">未完了</option>
            <option value="true">完了済み</option>
          </select>
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            優先度
          </label>
          <select
            value={filter.priority || ''}
            onChange={(e) => {
              const value = e.target.value
              handlePriorityFilter(value === '' ? undefined : value as Priority)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
