'use client'

import { useSession, signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import React, { useState } from 'react'

// 拡張された検索モーダルコンポーネント
interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (filters: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }) => void
  isAuthenticated: boolean
}

function SearchModal({ isOpen, onClose, onSearch, isAuthenticated }: SearchModalProps) {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [completed, setCompleted] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [dateRange, setDateRange] = useState<string>('')
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string
    name: string
    filters: {
      keyword: string
      category: string
      tags: string[]
      completed?: boolean
      priority?: string
      dateRange?: string
    }
  }>>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveSearchName, setSaveSearchName] = useState('')
  
  // コンポーネントマウント時に保存された検索条件を読み込み
  React.useEffect(() => {
    if (isOpen) {
      // 保存された検索条件一覧を読み込み
      const saved = localStorage.getItem('todoSavedSearches')
      if (saved) {
        try {
          setSavedSearches(JSON.parse(saved))
        } catch (error) {
          console.error('保存された検索条件一覧の読み込みに失敗:', error)
        }
      }

      // 最後に使った検索条件を読み込み（下位互換性のため）
      const lastFilters = localStorage.getItem('todoSearchFilters')
      if (lastFilters) {
        try {
          const filters = JSON.parse(lastFilters)
          setKeyword(filters.keyword || '')
          setCategory(filters.category || '')
          setTags(filters.tags ? filters.tags.join(', ') : '')
          setCompleted(filters.completed === undefined ? '' : filters.completed.toString())
          setPriority(filters.priority || '')
          setDateRange(filters.dateRange || '')
        } catch (error) {
          console.error('最後の検索条件の読み込みに失敗:', error)
        }
      }
    }
  }, [isOpen])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) return
    
    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t)
    const completedValue = completed === '' ? undefined : completed === 'true'
    const priorityValue = priority === '' ? undefined : priority
    const dateRangeValue = dateRange === '' ? undefined : dateRange
    
    const filters = {
      keyword,
      category,
      tags: tagArray,
      completed: completedValue,
      priority: priorityValue,
      dateRange: dateRangeValue
    }

    // 最後の検索条件として保存（下位互換性のため）
    localStorage.setItem('todoSearchFilters', JSON.stringify(filters))
    
    onSearch(filters)
    onClose()
  }
  
  const handleReset = () => {
    setKeyword('')
    setCategory('')
    setTags('')
    setCompleted('')
    setPriority('')
    setDateRange('')
    if (isAuthenticated) {
      onSearch({
        keyword: '',
        category: '',
        tags: [],
        completed: undefined,
        priority: undefined,
        dateRange: undefined
      })
    }
  }
  
  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) {
      alert('検索条件の名前を入力してください')
      return
    }

    const tagArray = tags.split(',').map(t => t.trim()).filter(t => t)
    const completedValue = completed === '' ? undefined : completed === 'true'
    const priorityValue = priority === '' ? undefined : priority
    const dateRangeValue = dateRange === '' ? undefined : dateRange
    
    const newSearch = {
      id: Date.now().toString(),
      name: saveSearchName.trim(),
      filters: {
        keyword,
        category,
        tags: tagArray,
        completed: completedValue,
        priority: priorityValue,
        dateRange: dateRangeValue
      }
    }

    const updatedSavedSearches = [...savedSearches, newSearch]
    setSavedSearches(updatedSavedSearches)
    
    try {
      localStorage.setItem('todoSavedSearches', JSON.stringify(updatedSavedSearches))
      setSaveSearchName('')
      setShowSaveDialog(false)
      alert(`🎉 検索条件「${newSearch.name}」を保存しました！`)
    } catch (error) {
      console.error('検索条件の保存に失敗:', error)
      alert('❌ 検索条件の保存に失敗しました。')
    }
  }

  const handleLoadSearch = (searchFilters: any) => {
    setKeyword(searchFilters.keyword || '')
    setCategory(searchFilters.category || '')
    setTags(searchFilters.tags ? searchFilters.tags.join(', ') : '')
    setCompleted(searchFilters.completed === undefined ? '' : searchFilters.completed.toString())
    setPriority(searchFilters.priority || '')
    setDateRange(searchFilters.dateRange || '')
  }

  const handleDeleteSearch = (searchId: string) => {
    if (!confirm('この検索条件を削除しますか？')) return
    
    const updatedSavedSearches = savedSearches.filter(search => search.id !== searchId)
    setSavedSearches(updatedSavedSearches)
    localStorage.setItem('todoSavedSearches', JSON.stringify(updatedSavedSearches))
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center pt-16">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            🔍 検索・フィルター
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl"
          >
            ✕
          </button>
        </div>
        
        {!isAuthenticated ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-4">🔒</div>
            <div>検索機能を使用するにはログインが必要です</div>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* アクションボタン */}
              <div className="flex gap-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
                >
                  🔍 検索
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(true)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  💾 保存
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  🧹 クリア
                </button>
              </div>

              {/* 保存ダイアログ */}
              {showSaveDialog && (
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    検索条件に名前をつけて保存
                  </h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                      placeholder="検索条件の名前を入力..."
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-600 dark:text-white"
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveSearch()}
                    />
                    <button
                      type="button"
                      onClick={handleSaveSearch}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveDialog(false)
                        setSaveSearchName('')
                      }}
                      className="px-3 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* 基本フィルター */}
              <div className="space-y-4">
                <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  📋 基本
                </h3>
                
                {/* キーワード検索 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    📝 キーワード検索
                  </label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="タイトルや説明文で検索..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* 完了状態 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    ✅ 完了状態
                  </label>
                  <select
                    value={completed}
                    onChange={(e) => setCompleted(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">すべて</option>
                    <option value="false">未完了</option>
                    <option value="true">完了済み</option>
                  </select>
                </div>

                {/* 優先度 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    ⚡ 優先度
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">すべて</option>
                    <option value="URGENT">緊急</option>
                    <option value="HIGH">高</option>
                    <option value="MEDIUM">中</option>
                    <option value="LOW">低</option>
                  </select>
                </div>

                {/* 期限 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    📅 期限
                  </label>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">すべて</option>
                    <option value="overdue">期限切れ</option>
                    <option value="today">今日</option>
                    <option value="tomorrow">明日</option>
                    <option value="this_week">今週</option>
                    <option value="next_week">来週</option>
                    <option value="this_month">今月</option>
                    <option value="next_month">来月</option>
                    <option value="no_due_date">期限なし</option>
                  </select>
                </div>

                {/* カテゴリー */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    📂 カテゴリ
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="仕事、プライベートなど"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* タグ */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    🏷️ タグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="重要, 会議, レビューなど"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </form>

            {/* 保存された検索条件一覧 */}
            {savedSearches.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  📚 保存された検索条件
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <button
                        onClick={() => handleLoadSearch(search.filters)}
                        className="flex-1 text-left text-sm text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        <div className="font-medium">{search.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {search.filters.keyword && `キーワード: ${search.filters.keyword}`}
                          {search.filters.category && ` | カテゴリ: ${search.filters.category}`}
                          {search.filters.priority && ` | 優先度: ${search.filters.priority}`}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteSearch(search.id)}
                        className="ml-2 p-1 text-red-500 hover:text-red-700 transition-colors"
                        title="削除"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

interface DashboardHeaderProps {
  onModalSearch?: (filters: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }) => void
}

export default function DashboardHeader({ onModalSearch }: DashboardHeaderProps) {
  const { data: session } = useSession()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  // 認証されていない場合でもヘッダーを表示（検索機能は無効）
  const isAuthenticated = !!session?.user

  const handleSearch = (filters: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }) => {
    // モーダルからの検索処理を親コンポーネントに委譲
    if (onModalSearch && isAuthenticated) {
      onModalSearch(filters)
    }
  }

  return (
    <>
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                ✨ <span className="hidden sm:inline">{isAuthenticated ? `${session.user?.name}専用` : ''}</span>Todo<span className="hidden xs:inline">アプリ</span>
              </h1>
            </div>

            {/* 検索ボタンとプロファイル情報 */}
            <div className="flex items-center gap-2 sm:gap-4">
              {isAuthenticated && (
                <button 
                  onClick={() => setIsSearchModalOpen(true)}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Todo検索"
                >
                  🔍
                </button>
              )}
              
              {session?.user && (
                <div className="flex items-center gap-2 sm:gap-3">
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt="Profile"
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full"
                      unoptimized
                    />
                  )}
                  <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {session.user.name}
                  </span>
                  <Link
                    href="/settings"
                    className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1"
                    title="アカウント設定"
                  >
                    ⚙️
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 検索モーダル */}
      {isSearchModalOpen && (
        <SearchModal 
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSearch={handleSearch}
          isAuthenticated={isAuthenticated}
        />
      )}
    </>
  )
}