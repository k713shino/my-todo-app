'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Priority } from '@prisma/client'
import type { TodoFilters, SavedSearch } from '@/types/todo'
import { dateRangeLabels, DateRangePreset } from '@/lib/date-utils'
import { useFilterPersistence } from '../hooks/useFilterPersistence'
import { withScrollPreservation } from '../hooks/useScrollPreservation'

interface TodoFiltersProps {
  filter: TodoFilters
  onFilterChange: (filter: TodoFilters) => void
  onManualSearch?: () => void
  enablePersistence?: boolean
}

const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

export default function TodoFilters({ filter, onFilterChange, onManualSearch, enablePersistence = true }: TodoFiltersProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [searchHistory, setSearchHistory] = useState<any[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  // 検索入力フィールドのローカル状態
  const [searchInputValue, setSearchInputValue] = useState(filter.search || '')
  // uncontrolled inputのref
  const uncontrolledTagInputRef = useRef<HTMLInputElement>(null)
  // 検索入力のref（フォーカス保持用）
  const searchInputRef = useRef<HTMLInputElement>(null)
  // IME入力中かどうかのフラグ
  const [isComposing, setIsComposing] = useState(false)
  // debounce用のタイマー
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 検索用debounceタイマー
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // フィルター永続化フック
  const { persistFilters, loadPersistedFilters, clearPersistedFilters } = useFilterPersistence()

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
    
    // 永続化されたフィルターを読み込み（初回のみ）
    if (enablePersistence) {
      const persistedFilters = loadPersistedFilters()
      if (Object.keys(persistedFilters).length > 0) {
        onFilterChange(persistedFilters)
        
        // uncontrolled inputの値も更新
        if (uncontrolledTagInputRef.current && persistedFilters.tags) {
          uncontrolledTagInputRef.current.value = persistedFilters.tags.join(', ')
        }
      }
    }
  }, [loadSavedSearches, enablePersistence, loadPersistedFilters, onFilterChange])

  // 検索入力値をフィルター変更に同期
  useEffect(() => {
    setSearchInputValue(filter.search || '')
  }, [filter.search])

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current)
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

  const handleCompletedFilter = withScrollPreservation((completed?: boolean) => {
    const newFilter = { ...filter, completed }
    onFilterChange(newFilter)
    if (enablePersistence) {
      persistFilters(newFilter)
    }
  })

  const handlePriorityFilter = withScrollPreservation((priority?: Priority) => {
    const newFilter = { ...filter, priority }
    onFilterChange(newFilter)
    if (enablePersistence) {
      persistFilters(newFilter)
    }
  })

  // 即座に実行する検索変更ハンドラー（スクロール位置保持付き）
  const handleSearchChangeImmediate = useCallback((search: string) => {
    withScrollPreservation(() => {
      const newFilter = { ...filter, search: search || undefined }
      onFilterChange(newFilter)
      if (enablePersistence) {
        persistFilters(newFilter)
      }
    })()
  }, [filter, onFilterChange, enablePersistence, persistFilters])

  // debounce版の検索変更ハンドラー
  const handleSearchChange = useCallback((search: string) => {
    // 既存のタイマーをクリア
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current)
    }
    
    // 200msのdebounceでフィルター更新を遅延
    searchDebounceTimerRef.current = setTimeout(() => {
      handleSearchChangeImmediate(search)
    }, 200)
  }, [handleSearchChangeImmediate])

  const handleCategoryChange = useCallback((category: string) => {
    withScrollPreservation(() => {
      const newFilter = { ...filter, category: category || undefined }
      onFilterChange(newFilter)
      if (enablePersistence) {
        persistFilters(newFilter)
      }
    })()
  }, [filter, onFilterChange, enablePersistence, persistFilters])

  const handleTagsChange = withScrollPreservation((tagsString: string) => {
    // カンマを含む文字列の処理
    const tags = tagsString.trim() ? 
      tagsString.split(',').map(tag => tag.trim()).filter(Boolean) : 
      undefined
    const newFilter = { ...filter, tags }
    onFilterChange(newFilter)
    if (enablePersistence) {
      persistFilters(newFilter)
    }
  })

  // debounce版のタグ更新関数（直接入力用）
  const debouncedHandleTagsChange = (tagsString: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      handleTagsChange(tagsString)
    }, 300) // 300ms待機
  }


  const handleDateRangeChange = withScrollPreservation((dateRange?: DateRangePreset) => {
    const newFilter = { ...filter, dateRange }
    onFilterChange(newFilter)
    if (enablePersistence) {
      persistFilters(newFilter)
    }
  })

  const saveCurrentSearch = async () => {
    if (!saveSearchName.trim()) return

    // 同名の検索条件が既に存在するかチェック
    const existingSearch = savedSearches.find(search => 
      search.name.toLowerCase() === saveSearchName.trim().toLowerCase()
    )
    
    if (existingSearch) {
      alert(`「${saveSearchName.trim()}」という名前の検索条件は既に存在しています。別の名前を使用してください。`)
      return
    }

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

    // 検索条件削除後、フィルターをクリア状態にする
    clearFilters()

    // バックグラウンドで削除API呼び出し（UIはすでに更新済み）
    fetch(`/api/todos/saved-searches/${id}`, { method: 'DELETE' })
      .catch(() => {
        // エラーが発生してもUIは更新済みなので何もしない
        // 404エラーやネットワークエラーは無視
      })
  }

  const clearFilters = () => {
    console.log('🧹 フィルタークリア')
    const emptyFilter = {}
    onFilterChange(emptyFilter)
    
    // uncontrolled inputもクリア
    if (uncontrolledTagInputRef.current) {
      uncontrolledTagInputRef.current.value = ''
    }
    
    // 永続化データもクリア
    if (enablePersistence) {
      clearPersistedFilters()
    }
  }

  const hasActiveFilters = Object.keys(filter).some(key => 
    filter[key as keyof TodoFilters] !== undefined && 
    filter[key as keyof TodoFilters] !== '' &&
    !(Array.isArray(filter[key as keyof TodoFilters]) && (filter[key as keyof TodoFilters] as any[]).length === 0)
  )

  return (
    <div className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-md dark:shadow-gray-900/50 space-y-3 sm:space-y-4 border border-gray-200 dark:border-gray-700">
      {/* ヘッダー - モバイル対応 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100">🔍 検索・フィルター</h3>
        <div className="flex items-center flex-wrap gap-2">
          {hasActiveFilters && (
            <>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-2 py-1 text-xs sm:text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 rounded"
              >
                💾 保存
              </button>
              <button
                onClick={clearFilters}
                className="px-2 py-1 text-xs sm:text-sm text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 transition-colors bg-purple-50 dark:bg-purple-900/20 rounded"
              >
                🧹 クリア
              </button>
            </>
          )}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-2 py-1 text-xs sm:text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-gray-700 rounded"
          >
            {showAdvanced ? '📝 簡単' : '🔧 詳細'}
          </button>
        </div>
      </div>

      {/* 検索バー - モバイル最適化 */}
      <div className="mb-3 sm:mb-4">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
          🔍 キーワード検索
        </label>
        <div className="flex gap-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchInputValue}
            onChange={(e) => {
              const newValue = e.target.value
              setSearchInputValue(newValue)
              handleSearchChange(newValue)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Enterキーで即座にフィルターを適用
                if (searchDebounceTimerRef.current) {
                  clearTimeout(searchDebounceTimerRef.current)
                }
                handleSearchChangeImmediate(searchInputValue)
                if (onManualSearch) {
                  onManualSearch()
                }
              }
            }}
            placeholder="タイトル・説明・カテゴリで検索..."
            className="flex-1 px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          />
          {onManualSearch && (
            <button
              onClick={onManualSearch}
              className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center min-w-[44px] justify-center"
              title="検索実行 (Enter)"
            >
              <span className="text-base sm:text-lg">🔍</span>
            </button>
          )}
        </div>
      </div>

      {/* 基本フィルター - モバイル対応 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* 完了状態 */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="false">未完了</option>
            <option value="true">完了済み</option>
          </select>
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ⚡ 優先度
          </label>
          <select
            value={filter.priority || ''}
            onChange={(e) => {
              const value = e.target.value
              handlePriorityFilter(value === '' ? undefined : value as Priority)
            }}
            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
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
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            📅 期限
          </label>
          <select
            value={filter.dateRange || ''}
            onChange={(e) => {
              const value = e.target.value
              handleDateRangeChange(value === '' ? undefined : value as DateRangePreset)
            }}
            className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
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

      {/* 詳細フィルター - モバイル対応 */}
      {showAdvanced && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* カテゴリ */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                📂 カテゴリ
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            {/* タグ */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                🏷️ タグ
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
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存済み検索 - モバイル対応 */}
      {savedSearches.length > 0 ? (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 sm:mb-3">
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
              💾 保存済み検索 ({savedSearches.length}件)
            </h4>
            <button
              onClick={loadSavedSearches}
              className="self-start sm:self-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-gray-700 rounded min-w-[44px]"
              title="再読み込み"
            >
              🔄 更新
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((savedSearch) => (
              <div key={savedSearch.id} className="flex items-center space-x-1">
                <button
                  onClick={() => loadSavedSearch(savedSearch)}
                  className="px-3 py-2 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  {savedSearch.name}
                </button>
                <button
                  onClick={() => deleteSavedSearch(savedSearch.id, savedSearch.name)}
                  className="w-6 h-6 sm:w-4 sm:h-4 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[auto] sm:min-h-[auto]"
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
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
            <div className="text-xs text-gray-400">
              💭 保存済み検索: {savedSearches.length}件（非表示）
            </div>
          </div>
        )
      )}

      {/* 検索保存ダイアログ - モバイル対応 */}
      {showSaveDialog && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder="検索名を入力"
              className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
            />
            <div className="flex gap-2 sm:gap-0 sm:space-x-2">
              <button
                onClick={saveCurrentSearch}
                className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors min-w-[44px] min-h-[44px]"
              >
                💾 保存
              </button>
              <button
                onClick={() => setShowSaveDialog(false)}
                className="flex-1 sm:flex-none px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm sm:text-base rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors min-w-[44px] min-h-[44px]"
              >
                ❌ キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
