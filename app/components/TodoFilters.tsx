'use client'

import { useState, useEffect } from 'react'
import { Priority } from '@prisma/client'
import type { TodoFilters, SavedSearch } from '@/types/todo'
import { dateRangeLabels, DateRangePreset } from '@/lib/date-utils'

interface TodoFiltersProps {
  filter: TodoFilters
  onFilterChange: (filter: TodoFilters) => void
}

const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

export default function TodoFilters({ filter, onFilterChange }: TodoFiltersProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    loadSavedSearches()
    loadSearchHistory()
  }, [])

  const loadSavedSearches = async () => {
    try {
      const response = await fetch('/api/todos/saved-searches')
      if (response.ok) {
        setSavedSearches(await response.json())
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    }
  }

  const loadSearchHistory = async () => {
    try {
      const response = await fetch('/api/todos/search-history?limit=10')
      if (response.ok) {
        setSearchHistory(await response.json())
      }
    } catch (error) {
      console.error('Failed to load search history:', error)
    }
  }

  const handleCompletedFilter = (completed?: boolean) => {
    onFilterChange({ ...filter, completed })
  }

  const handlePriorityFilter = (priority?: Priority) => {
    onFilterChange({ ...filter, priority })
  }

  const handleSearchChange = (search: string) => {
    onFilterChange({ ...filter, search: search || undefined })
  }

  const handleCategoryChange = (category: string) => {
    onFilterChange({ ...filter, category: category || undefined })
  }

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString.trim() ? tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : undefined
    onFilterChange({ ...filter, tags })
  }

  const handleDateRangeChange = (dateRange?: DateRangePreset) => {
    onFilterChange({ ...filter, dateRange })
  }

  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return

    try {
      const response = await fetch('/api/todos/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveSearchName.trim(),
          filters: filter
        })
      })
      
      if (response.ok) {
        loadSavedSearches()
        setShowSaveDialog(false)
        setSaveSearchName('')
      }
    } catch (error) {
      console.error('Failed to save search:', error)
    }
  }

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    const filters = JSON.parse(savedSearch.filters) as TodoFilters
    onFilterChange(filters)
  }

  const deleteSavedSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/todos/saved-searches/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        loadSavedSearches()
      }
    } catch (error) {
      console.error('Failed to delete saved search:', error)
    }
  }

  const clearFilters = () => {
    onFilterChange({})
  }

  const hasActiveFilters = Object.keys(filter).some(key => 
    filter[key as keyof TodoFilters] !== undefined && 
    filter[key as keyof TodoFilters] !== '' &&
    !(Array.isArray(filter[key as keyof TodoFilters]) && (filter[key as keyof TodoFilters] as any[]).length === 0)
  )

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md dark:shadow-gray-900/50 space-y-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">🔍 検索・フィルター</h3>
        <div className="flex items-center space-x-2">
          {hasActiveFilters && (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              保存
            </button>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors"
            >
              クリア
            </button>
          )}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
          >
            {showAdvanced ? '簡単表示' : '詳細表示'}
          </button>
        </div>
      </div>

      {/* 基本検索 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 検索 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            検索
          </label>
          <input
            type="text"
            value={filter.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="タイトル・説明・カテゴリで検索"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          />
        </div>

        {/* 完了状態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="false">未完了</option>
            <option value="true">完了済み</option>
          </select>
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            優先度
          </label>
          <select
            value={filter.priority || ''}
            onChange={(e) => {
              const value = e.target.value
              handlePriorityFilter(value === '' ? undefined : value as Priority)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          >
            <option value="">すべて</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 日付範囲 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            期限
          </label>
          <select
            value={filter.dateRange || ''}
            onChange={(e) => {
              const value = e.target.value
              handleDateRangeChange(value === '' ? undefined : value as DateRangePreset)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          >
            <option value="">すべて</option>
            {Object.entries(dateRangeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 詳細フィルター */}
      {showAdvanced && (
        <div className="border-t pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* カテゴリ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                カテゴリ
              </label>
              <input
                type="text"
                value={filter.category || ''}
                onChange={(e) => handleCategoryChange(e.target.value)}
                placeholder="カテゴリで絞り込み"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            {/* タグ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                タグ
              </label>
              <input
                type="text"
                value={filter.tags?.join(', ') || ''}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="タグをカンマ区切りで入力"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存済み検索 */}
      {savedSearches.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">保存済み検索</h4>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((savedSearch) => (
              <div key={savedSearch.id} className="flex items-center space-x-1">
                <button
                  onClick={() => loadSavedSearch(savedSearch)}
                  className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                >
                  {savedSearch.name}
                </button>
                <button
                  onClick={() => deleteSavedSearch(savedSearch.id)}
                  className="w-4 h-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 検索保存ダイアログ */}
      {showSaveDialog && (
        <div className="border-t pt-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder="検索名を入力"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
            />
            <button
              onClick={saveCurrentSearch}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
