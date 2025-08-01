'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Priority } from '@prisma/client'
import type { TodoFilters, SavedSearch } from '@/types/todo'
import { dateRangeLabels, DateRangePreset } from '@/lib/date-utils'

interface TodoFiltersProps {
  filter: TodoFilters
  onFilterChange: (filter: TodoFilters) => void
  onManualSearch?: () => void
}

const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

export default function TodoFilters({ filter, onFilterChange, onManualSearch }: TodoFiltersProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  // uncontrolled inputのref
  const uncontrolledTagInputRef = useRef<HTMLInputElement>(null)
  // IME入力中かどうかのフラグ
  const [isComposing, setIsComposing] = useState(false)
  // debounce用のタイマー
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 保存済み検索の状態変更をデバッグ（最適化）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 保存済み検索state変更:', savedSearches.length, '件')
      if (savedSearches.length > 0) {
        console.log('📝 詳細:', savedSearches.map(s => ({ id: s.id, name: s.name })))
      }
    }
  }, [savedSearches.length]) // lengthのみ監視してオブジェクト全体の監視を避ける

  const loadSavedSearches = useCallback(async () => {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 保存済み検索を読み込み中...')
      }
      const response = await fetch('/api/todos/saved-searches')
      if (response.ok) {
        const data = await response.json()
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 読み込まれた保存済み検索:', data.length, '件')
        }
        setSavedSearches(data)
      } else {
        console.error('保存済み検索の読み込みに失敗:', response.status)
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error)
    }
  }, [])

  useEffect(() => {
    loadSavedSearches()
    loadSearchHistory()
  }, [loadSavedSearches])

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

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
    // カンマを含む文字列の処理
    const tags = tagsString.trim() ? 
      tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : 
      undefined
    onFilterChange({ ...filter, tags })
  }

  // debounce版のタグ更新関数（直接入力用）
  const debouncedHandleTagsChange = (tagsString: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      handleTagsChange(tagsString)
    }, 300) // 300ms待機
  }


  const handleDateRangeChange = (dateRange?: DateRangePreset) => {
    onFilterChange({ ...filter, dateRange })
  }

  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('💾 検索を保存中:', saveSearchName.trim())
        console.log('📦 保存するフィルター:', JSON.stringify(filter))
      }
      const filtersToSave = JSON.stringify(filter)
      
      const response = await fetch('/api/todos/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveSearchName.trim(),
          filters: filtersToSave
        })
      })
      
      if (response.ok) {
        const newSavedSearch = await response.json()
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ 検索保存成功:', newSavedSearch)
        }
        // 即時反映: 新しい保存済み検索をリストに追加
        setSavedSearches(prev => {
          const updated = [newSavedSearch, ...prev]
          if (process.env.NODE_ENV === 'development') {
            console.log('📋 更新後の保存済み検索数:', updated.length)
          }
          return updated
        })
        
        // 楽観的更新で即座に反映済みなので、再読み込みは不要
        
        setShowSaveDialog(false)
        setSaveSearchName('')
      } else {
        console.error('Failed to save search:', response.status)
        alert('検索の保存に失敗しました')
      }
    } catch (error) {
      console.error('Failed to save search:', error)
      alert('検索の保存に失敗しました')
    }
  }

  const loadSavedSearch = (savedSearch: SavedSearch) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📖 保存済み検索を読み込み:', savedSearch.name)
    }
    const filters = JSON.parse(savedSearch.filters) as TodoFilters
    
    onFilterChange(filters)
    
    // uncontrolled inputの値を手動更新
    if (uncontrolledTagInputRef.current) {
      const newValue = filters.tags?.join(', ') || ''
      uncontrolledTagInputRef.current.value = newValue
    }
    
    // 自動検索は実行せず、フィルター条件のみ読み込み
    // ユーザーが手動で検索ボタンを押すまで待機
  }

  const deleteSavedSearch = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除してもよろしいですか？`)) {
      return
    }

    // 楽観的UI更新：即座にUIから削除
    setSavedSearches(prev => prev.filter(search => search.id !== id))

    // バックグラウンドで削除API呼び出し（UIはすでに更新済み）
    fetch(`/api/todos/saved-searches/${id}`, { method: 'DELETE' })
      .catch(() => {
        // エラーが発生してもUIは更新済みなので何もしない
        // 404エラーやネットワークエラーは無視
      })
  }

  const clearFilters = () => {
    onFilterChange({})
    
    // uncontrolled inputもクリア
    if (uncontrolledTagInputRef.current) {
      uncontrolledTagInputRef.current.value = ''
    }
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

      {/* 検索バー */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          🔍 キーワード検索
        </label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={filter.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onManualSearch) {
                onManualSearch()
              }
            }}
            placeholder="タイトル・説明・カテゴリで検索..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          />
          {onManualSearch && (
            <button
              onClick={onManualSearch}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center"
              title="検索実行 (Enter)"
            >
              <span className="text-lg">🔍</span>
            </button>
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* 完了状態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            📋 完了状態
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
            ⚡ 優先度
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
            📅 期限
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onManualSearch) {
                    onManualSearch()
                  }
                }}
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
                ref={uncontrolledTagInputRef}
                type="text"
                defaultValue={filter.tags?.join(', ') || ''}
                onChange={(e) => {
                  // IME入力中は即座に更新、直接入力はdebounce
                  if (isComposing) {
                    // IME入力中は何もしない（onCompositionEndで処理）
                    return
                  } else {
                    // 直接入力時はdebounce処理
                    debouncedHandleTagsChange(e.target.value)
                  }
                }}
                onCompositionStart={() => {
                  setIsComposing(true)
                }}
                onCompositionEnd={(e) => {
                  setIsComposing(false)
                  // IME入力完了時は即座に更新
                  handleTagsChange((e.target as HTMLInputElement).value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onManualSearch && !isComposing) {
                    e.preventDefault()
                    onManualSearch()
                  }
                }}
                placeholder="タグをカンマ区切りで入力"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存済み検索 */}
      {savedSearches.length > 0 ? (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              保存済み検索 ({savedSearches.length}件)
            </h4>
            <button
              onClick={loadSavedSearches}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              title="再読み込み"
            >
              🔄
            </button>
          </div>
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
                  onClick={() => deleteSavedSearch(savedSearch.id, savedSearch.name)}
                  className="w-4 h-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // 開発用デバッグ表示
        process.env.NODE_ENV === 'development' && (
          <div className="border-t pt-4">
            <div className="text-xs text-gray-400">
              💭 保存済み検索: {savedSearches.length}件（非表示）
            </div>
          </div>
        )
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
