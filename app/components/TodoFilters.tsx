'use client'

import { useState, useEffect, useCallback, useRef, startTransition } from 'react'
import { Priority } from '@prisma/client'
import type { TodoFilters, SavedSearch } from '@/types/todo'
import { DateRangePreset } from '@/lib/date-utils'
import { useFilterPersistence } from '../hooks/useFilterPersistence'
import { withScrollPreservation } from '../hooks/useScrollPreservation'
import { usePageMovementDebugger } from '../hooks/usePageMovementDebugger'

interface TodoFiltersProps {
  filter: TodoFilters
  onFilterChange: (filter: TodoFilters) => void
  onManualSearch?: () => void
  enablePersistence?: boolean
}

const _priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

export default function TodoFilters({ filter, onFilterChange, onManualSearch, enablePersistence = true }: TodoFiltersProps) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  // uncontrolled inputのref
  const uncontrolledTagInputRef = useRef<HTMLInputElement>(null)
  const uncontrolledSearchInputRef = useRef<HTMLInputElement>(null)
  const uncontrolledCategoryInputRef = useRef<HTMLInputElement>(null)
  // debounce用のタイマー
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  
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
  }, [savedSearches]) // savedSearchesを監視


  // 初期化処理（一度のみ実行）
  useEffect(() => {
    // 保存済み検索を読み込み
    const initSavedSearches = async () => {
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 保存済み検索を初期化中...')
        }
        const response = await fetch('/api/todos/saved-searches')
        if (response.ok) {
          const data = await response.json()
          if (process.env.NODE_ENV === 'development') {
            console.log('📋 保存済み検索初期化完了:', data.length, '件')
          }
          setSavedSearches(data)
        }
      } catch (error) {
        console.error('保存済み検索の初期化に失敗:', error)
      }
    }

    // 検索履歴を読み込み
    const initSearchHistory = async () => {
      try {
        const response = await fetch('/api/todos/search-history?limit=10')
        if (response.ok) {
          // TODO: Add searchHistory state if needed
          await response.json()
        }
      } catch (error) {
        console.error('検索履歴の初期化に失敗:', error)
      }
    }

    // 永続化されたフィルターを読み込み
    const initPersistedFilters = () => {
      if (enablePersistence) {
        const persistedFilters = loadPersistedFilters()
        if (Object.keys(persistedFilters).length > 0) {
          onFilterChange(persistedFilters)
          
          // uncontrolled inputの値も更新
          setTimeout(() => {
            if (uncontrolledTagInputRef.current && persistedFilters.tags) {
              uncontrolledTagInputRef.current.value = persistedFilters.tags.join(', ')
            }
            if (uncontrolledSearchInputRef.current && persistedFilters.search) {
              uncontrolledSearchInputRef.current.value = persistedFilters.search
            }
            if (uncontrolledCategoryInputRef.current && persistedFilters.category) {
              uncontrolledCategoryInputRef.current.value = persistedFilters.category
            }
          }, 0)
        }
      }
    }

    // 初期化処理を実行
    initSavedSearches()
    initSearchHistory()
    initPersistedFilters()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 依存配列を空にして初回のみ実行（意図的）

  // コンポーネントアンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])


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

  // debounce版の検索変更ハンドラー（uncontrolled input用）
  const debouncedHandleSearchChange = (search: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      handleSearchChangeImmediate(search)
    }, 300) // 300ms待機
  }

  const handleCategoryChangeImmediate = useCallback((category: string) => {
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

  // debounce版のカテゴリ更新関数（uncontrolled input用）
  const debouncedHandleCategoryChange = (category: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      handleCategoryChangeImmediate(category)
    }, 300) // 300ms待機
  }

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
      uncontrolledTagInputRef.current.value = filters.tags?.join(', ') || ''
    }
    if (uncontrolledSearchInputRef.current) {
      uncontrolledSearchInputRef.current.value = filters.search || ''
    }
    if (uncontrolledCategoryInputRef.current) {
      uncontrolledCategoryInputRef.current.value = filters.category || ''
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
    if (uncontrolledSearchInputRef.current) {
      uncontrolledSearchInputRef.current.value = ''
    }
    if (uncontrolledCategoryInputRef.current) {
      uncontrolledCategoryInputRef.current.value = ''
    }
    
    // 永続化データもクリア
    if (enablePersistence) {
      clearPersistedFilters()
    }
  }

  const hasActiveFilters = Object.keys(filter).some(key =>
    filter[key as keyof TodoFilters] !== undefined &&
    filter[key as keyof TodoFilters] !== '' &&
    !(Array.isArray(filter[key as keyof TodoFilters]) && (filter[key as keyof TodoFilters] as unknown[]).length === 0)
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
            className="px-2 py-1 text-xs sm:text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 transition-colors bg-gray-50 dark:bg-gray-900/20 rounded"
          >
            {showAdvanced ? '📋 基本' : '🔧 詳細'}
          </button>
        </div>
      </div>

      {/* メイン検索フィールド - 修正済み */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            📝 キーワード検索
          </label>
          <div className="flex gap-2">
            <input
              ref={uncontrolledSearchInputRef}
              type="text"
              defaultValue={filter.search || ''}
              onChange={(e) => {
                debouncedHandleSearchChange(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearchChangeImmediate(e.currentTarget.value) // Enter時は即座に検索実行
                  onManualSearch?.()
                }
              }}
              placeholder="タイトルや説明文で検索..."
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              onClick={() => {
                const currentValue = uncontrolledSearchInputRef.current?.value || ''
                handleSearchChangeImmediate(currentValue) // 手動検索ボタンは即座に実行
                onManualSearch?.()
              }}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              🔍 検索
            </button>
          </div>
        </div>
      </div>

      {/* 基本フィルター */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 完了状態 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">✅ 完了状態</label>
          <select
            value={filter.completed === undefined ? '' : filter.completed.toString()}
            onChange={(e) => {
              const value = e.target.value === '' ? undefined : e.target.value === 'true'
              handleCompletedFilter(value)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">すべて</option>
            <option value="false">未完了のみ</option>
            <option value="true">完了済みのみ</option>
          </select>
        </div>

        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">⚡ 優先度</label>
          <select
            value={filter.priority || ''}
            onChange={(e) => {
              const value = e.target.value as Priority || undefined
              handlePriorityFilter(value)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📅 期限</label>
          <select
            value={filter.dateRange || ''}
            onChange={(e) => {
              const value = e.target.value as DateRangePreset || undefined
              handleDateRangeChange(value)
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
      </div>

      {/* 詳細フィルター（展開時のみ表示） */}
      {showAdvanced && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-600 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* カテゴリ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">📂 カテゴリ</label>
              <input
                ref={uncontrolledCategoryInputRef}
                type="text"
                defaultValue={filter.category || ''}
                onChange={(e) => debouncedHandleCategoryChange(e.target.value)}
                placeholder="仕事、プライベートなど"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* タグ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                🏷️ タグ（カンマ区切り）
              </label>
              <input
                ref={uncontrolledTagInputRef}
                type="text"
                defaultValue={filter.tags?.join(', ') || ''}
                onChange={(e) => debouncedHandleTagsChange(e.target.value)}
                placeholder="重要, 会議, レビューなど"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* 保存済み検索 */}
      {savedSearches.length > 0 && (
        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">💾 保存済み検索</h4>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map(savedSearch => (
              <div key={savedSearch.id} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded">
                <button
                  onClick={() => loadSavedSearch(savedSearch)}
                  className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300 rounded-l hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {savedSearch.name}
                </button>
                <button
                  onClick={() => deleteSavedSearch(savedSearch.id, savedSearch.name)}
                  className="px-2 py-1 text-sm text-red-600 dark:text-red-400 rounded-r hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
        <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              💾 検索条件を保存
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                placeholder="検索条件の名前を入力"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && saveSearchName.trim()) {
                    saveCurrentSearch()
                  }
                }}
              />
              <button
                onClick={saveCurrentSearch}
                disabled={!saveSearchName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setSaveSearchName('')
                }}
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
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