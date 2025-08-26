'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { Priority } from '@prisma/client'
import type { TodoFilters, SavedSearch } from '@/types/todo'
import { dateRangeLabels, DateRangePreset } from '@/lib/date-utils'
import { useFilterPersistence } from '../hooks/useFilterPersistence'
import { withScrollPreservation } from '../hooks/useScrollPreservation'
import { usePageMovementDebugger } from '../hooks/usePageMovementDebugger'

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
  
  // デバッグフック（開発環境でのみ有効）
  // 注意: 条件付きhook呼び出しは避け、hooks内で条件分岐させる
  usePageMovementDebugger()

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
    startTransition(() => {
      const newFilter = { ...filter, completed }
      onFilterChange(newFilter)
      if (enablePersistence) {
        persistFilters(newFilter)
      }
    })
  })

  const handlePriorityFilter = withScrollPreservation((priority?: Priority) => {
    startTransition(() => {
      const newFilter = { ...filter, priority }
      onFilterChange(newFilter)
      if (enablePersistence) {
        persistFilters(newFilter)
      }
    })
  })

  // 即座に実行する検索変更ハンドラー（スクロール位置保持付き）
  const handleSearchChangeImmediate = useCallback((search: string) => {
    withScrollPreservation(() => {
      startTransition(() => {
        const newFilter = { ...filter, search: search || undefined }
        onFilterChange(newFilter)
        if (enablePersistence) {
          persistFilters(newFilter)
        }
      })
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
      startTransition(() => {
        const newFilter = { ...filter, category: category || undefined }
        onFilterChange(newFilter)
        if (enablePersistence) {
          persistFilters(newFilter)
        }
      })
    })()
  }, [filter, onFilterChange, enablePersistence, persistFilters])

  const handleTagsChange = withScrollPreservation((tagsString: string) => {
    startTransition(() => {
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
    startTransition(() => {
      const newFilter = { ...filter, dateRange }
      onFilterChange(newFilter)
      if (enablePersistence) {
        persistFilters(newFilter)
      }
    })
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
            className="px-2 py-1 text-xs sm:text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-700 rounded"
          >
            ⚙️ {showAdvanced ? '簡易' : '詳細'}
          </button>
        </div>
      </div>

      {/* 検索バー */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <input
            ref={searchInputRef}
            type="text"
            value={searchInputValue}
            onChange={(e) => {
              const newValue = e.target.value
              setSearchInputValue(newValue)
              console.log('🔤 検索入力onChange:', newValue)
              
              // IME入力中でなければ即座にdebounce検索を開始
              if (!isComposing) {
                handleSearchChange(newValue)
              }
            }}
            onCompositionStart={() => {
              console.log('🌏 IME入力開始')
              setIsComposing(true)
            }}
            onCompositionEnd={(e) => {
              console.log('🌏 IME入力終了:', e.currentTarget.value)
              setIsComposing(false)
              // IME入力が確定したら検索実行
              handleSearchChange(e.currentTarget.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault() // フォーム送信によるページリロードを防止
                console.log('⚡ Enter押下 - 手動検索実行:', searchInputValue)
                handleSearchChangeImmediate(searchInputValue) // Enter時は即座に検索実行
                if (onManualSearch) {
                  onManualSearch()
                }
              }
            }}
            placeholder="キーワード検索（タイトル・説明）"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm transition-colors"
          />
        </div>
        <button
          onClick={() => {
            console.log('🔍 手動検索ボタンクリック:', searchInputValue)
            handleSearchChangeImmediate(searchInputValue) // 手動検索ボタンは即座に実行
            if (onManualSearch) {
              onManualSearch()
            }
          }}
          className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm whitespace-nowrap dark:bg-purple-500 dark:hover:bg-purple-600"
        >
          🔍 検索
        </button>
      </div>

      {/* 基本フィルター */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 完了状態 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">完了状態</label>
          <select
            value={filter.completed === undefined ? '' : filter.completed.toString()}
            onChange={(e) => {
              const value = e.target.value === '' ? undefined : e.target.value === 'true'
              handleCompletedFilter(value)
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="false">未完了</option>
            <option value="true">完了済み</option>
          </select>
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">優先度</label>
          <select
            value={filter.priority || ''}
            onChange={(e) => {
              const value = e.target.value as Priority || undefined
              handlePriorityFilter(value)
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="URGENT">🔥 緊急</option>
            <option value="HIGH">🔴 高</option>
            <option value="MEDIUM">🟡 中</option>
            <option value="LOW">🔵 低</option>
          </select>
        </div>

        {/* 日付範囲 */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">期限</label>
          <select
            value={filter.dateRange || ''}
            onChange={(e) => {
              const value = e.target.value as DateRangePreset || undefined
              handleDateRangeChange(value)
            }}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">すべて</option>
            <option value="overdue">📅 期限切れ</option>
            <option value="today">📅 今日</option>
            <option value="tomorrow">📅 明日</option>
            <option value="this_week">📅 今週</option>
            <option value="next_week">📅 来週</option>
            <option value="this_month">📅 今月</option>
            <option value="next_month">📅 来月</option>
            <option value="no_due_date">📅 期限なし</option>
          </select>
        </div>

        {/* カテゴリ（詳細表示時のみ） */}
        {showAdvanced && (
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">カテゴリ</label>
            <input
              type="text"
              value={filter.category || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              placeholder="カテゴリ名"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* 詳細フィルター（展開時のみ表示） */}
      {showAdvanced && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-1 gap-3">
            {/* タグ */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                タグ（カンマ区切り）
              </label>
              <input
                ref={uncontrolledTagInputRef}
                type="text"
                defaultValue={filter.tags?.join(', ') || ''}
                onChange={(e) => debouncedHandleTagsChange(e.target.value)}
                placeholder="重要, 仕事, プライベート"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存済み検索 */}
      {savedSearches.length > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">💾 保存済み検索</h4>
          <div className="flex flex-wrap gap-1">
            {savedSearches.map(savedSearch => (
              <div key={savedSearch.id} className="flex items-center">
                <button
                  onClick={() => loadSavedSearch(savedSearch)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-l hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {savedSearch.name}
                </button>
                <button
                  onClick={() => deleteSavedSearch(savedSearch.id, savedSearch.name)}
                  className="px-1 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-r hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
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
        <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={saveSearchName}
              onChange={(e) => setSaveSearchName(e.target.value)}
              placeholder="検索条件の名前"
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex gap-2">
              <button
                onClick={saveCurrentSearch}
                disabled={!saveSearchName.trim()}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setSaveSearchName('')
                }}
                className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
