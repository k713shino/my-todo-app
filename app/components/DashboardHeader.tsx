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
  }, advanced?: Record<string, string>) => void
  isAuthenticated: boolean
}

function SearchModal({ isOpen, onClose, onSearch, isAuthenticated }: SearchModalProps) {
  const keywordInputRef = React.useRef<HTMLInputElement | null>(null)
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
  // 高度検索のUI状態
  const [regex, setRegex] = useState('')
  const [regexFields, setRegexFields] = useState<string[]>(['title','description','category','tags'])
  const [regexFlagI, setRegexFlagI] = useState<boolean>(true)
  const [regexError, setRegexError] = useState<string>('')
  const [tagMode, setTagMode] = useState<'or'|'and'>('or')
  const [statusMulti, setStatusMulti] = useState<string[]>([])
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [weightPreset, setWeightPreset] = useState<string>('default')
  
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
      // キーワード入力へフォーカス
      setTimeout(() => keywordInputRef.current?.focus(), 0)
    }
  }, [isOpen])

  // 正規表現のライブ検証と i フラグ同期
  React.useEffect(() => {
    // iフラグの付与/削除（ユーザー入力を壊さないよう、末尾のフラグを調整）
    const normalizeWithFlag = (src: string, wantI: boolean) => {
      // 形式: /pat/flags または field:/pat/flags
      const mField = src.match(/^([a-zA-Z_]+):\/(.*)\/(\w*)$/)
      const mAll = src.match(/^\/(.*)\/(\w*)$/)
      if (!mField && !mAll) return src // 不明な形式はそのまま
      const isField = !!mField
      const pat = isField ? mField![2] : mAll![1]
      let flags = (isField ? mField![3] : mAll![2]) || ''
      const hasI = flags.includes('i')
      if (wantI && !hasI) flags += 'i'
      if (!wantI && hasI) flags = flags.replace('i','')
      return isField ? `${mField![1]}:/${pat}/${flags}` : `/${pat}/${flags}`
    }
    setRegex(prev => normalizeWithFlag(prev, regexFlagI))
  }, [regexFlagI])

  React.useEffect(() => {
    // ライブ検証
    const validate = (src: string) => {
      setRegexError('')
      if (!src.trim()) return
      const mField = src.match(/^([a-zA-Z_]+):\/(.*)\/(\w*)$/)
      const mAll = src.match(/^\/(.*)\/(\w*)$/)
      let pat = ''
      let flags = ''
      if (mField) { pat = mField[2]; flags = mField[3] || '' }
      else if (mAll) { pat = mAll[1]; flags = mAll[2] || '' }
      else { setRegexError('形式は /パターン/フラグ または field:/パターン/フラグ'); return }
      try { new RegExp(pat, flags) } catch (e: unknown) { setRegexError(`正規表現エラー: ${(e as { message?: string })?.message || '不正な式'}`) }
      // iフラグUIと同期
      setRegexFlagI(flags.includes('i'))
    }
    validate(regex)
  }, [regex])
  
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
    
    // 高度検索のクエリパラメータを組み立て
    const params: Record<string, string> = {}
    // 高度検索の有無を先に判定
    const hasAdvanced = (
      (!!regex.trim()) ||
      (statusMulti.length > 0) ||
      (tagMode === 'and' && filters.tags.length > 0) ||
      (!!dateFrom || !!dateTo) ||
      (weightPreset !== 'default')
    )
    if (hasAdvanced && filters.keyword) params.q = filters.keyword
    if (regex.trim()) {
      params.regex = regex.trim()
      if (regexFields && regexFields.length > 0) params.fields = regexFields.join(',')
    }
    if (statusMulti.length > 0) params.status = statusMulti.join(',')
    if (filters.tags.length > 0) {
      if (tagMode === 'and') params.tags_all = filters.tags.join(',')
      else params.tags = filters.tags.join(',')
    }
    if (hasAdvanced && filters.completed !== undefined) params.completed = String(filters.completed)
    if (hasAdvanced && filters.priority) params.priority = String(filters.priority)
    if (hasAdvanced && filters.category) params.category = filters.category
    if (hasAdvanced && filters.dateRange) params.dateRange = String(filters.dateRange)
    if (dateFrom || dateTo) {
      const expr = {
        field: 'dueDate',
        type: 'range',
        ...(dateFrom ? { from: new Date(dateFrom).toISOString() } : {}),
        ...(dateTo ? { to: new Date(dateTo).toISOString() } : {}),
      }
      params.expr = JSON.stringify(expr)
    }
    const presets: Record<string, Record<string, number>> = {
      default: {},
      urgent_first: { priorityUrgent: 6, priorityHigh: 3 },
      due_soon_first: { dueSoon: 4, overdue: 5 },
      title_exact_first: { titleExact: 10, titlePartial: 2 },
    }
    if (weightPreset !== 'default') {
      params.weights = JSON.stringify(presets[weightPreset] || {})
    }

    // 高度検索が有効な時のみ advanced を渡す
    const advanced = hasAdvanced && Object.keys(params).length > 0 ? params : undefined
    onSearch(filters, advanced)
    onClose()
  }
  
  const handleReset = () => {
    setKeyword('')
    setCategory('')
    setTags('')
    setCompleted('')
    setPriority('')
    setDateRange('')
    // 高度検索UIのリセット
    setRegex('')
    setRegexFields(['title','description','category','tags'])
    setRegexFlagI(true)
    setRegexError('')
    setStatusMulti([])
    setTagMode('or')
    setDateFrom('')
    setDateTo('')
    setWeightPreset('default')
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

  const handleLoadSearch = (searchFilters: Record<string, unknown>) => {
    const keywordValue = typeof searchFilters.keyword === 'string' ? searchFilters.keyword : ''
    const categoryValue = typeof searchFilters.category === 'string' ? searchFilters.category : ''
    const rawTags = searchFilters.tags
    const tagsArray = Array.isArray(rawTags)
      ? rawTags.filter((tag): tag is string => typeof tag === 'string')
      : typeof rawTags === 'string'
        ? rawTags.split(',').map(tag => tag.trim()).filter(Boolean)
        : []
    const completedValue = typeof searchFilters.completed === 'boolean'
      ? searchFilters.completed
      : searchFilters.completed === 'true'
        ? true
        : searchFilters.completed === 'false'
          ? false
          : undefined
    const priorityValue = typeof searchFilters.priority === 'string' ? searchFilters.priority : ''
    const dateRangeValue = typeof searchFilters.dateRange === 'string' ? searchFilters.dateRange : ''

    setKeyword(keywordValue)
    setCategory(categoryValue)
    setTags(tagsArray.join(', '))
    setCompleted(completedValue === undefined ? '' : String(completedValue))
    setPriority(priorityValue)
    setDateRange(dateRangeValue)

    // 検索条件を読み込んだ後、自動的に検索を実行
    onSearch({
      keyword: keywordValue,
      category: categoryValue,
      tags: tagsArray,
      completed: completedValue,
      priority: priorityValue || undefined,
      dateRange: dateRangeValue || undefined,
    })
    onClose()
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
                    ref={keywordInputRef}
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

                {/* タグ */
                }
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    🏷️ タグ（カンマ区切り）
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="重要, 会議, レビューなど"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    />
                    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <label className="inline-flex items-center gap-1"><input type="radio" name="tagMode" value="or" checked={tagMode==='or'} onChange={()=>setTagMode('or')} />OR</label>
                      <label className="inline-flex items-center gap-1"><input type="radio" name="tagMode" value="and" checked={tagMode==='and'} onChange={()=>setTagMode('and')} />AND</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 高度検索 */}
              <div className="space-y-4 mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">🧪 高度検索</h3>
                {/* 正規表現 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">正規表現 <span className="text-[11px] text-gray-500">（例: /bug|バグ/i または title:/^feat/i）</span></label>
                  <input type="text" value={regex} onChange={(e)=>setRegex(e.target.value)} placeholder="/pattern/i または title:/^feat/i" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white" />
                  {/* フィールド選択とフラグ */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    {['title','description','category','tags'].map(f => (
                      <label key={f} className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                        <input type="checkbox" checked={regexFields.includes(f)} onChange={(e)=>setRegexFields(prev => e.target.checked ? Array.from(new Set([...prev, f])) : prev.filter(x=>x!==f))} />{f}
                      </label>
                    ))}
                    <label className="inline-flex items-center gap-1 ml-auto text-gray-600 dark:text-gray-300">
                      <input type="checkbox" checked={regexFlagI} onChange={(e)=>setRegexFlagI(e.target.checked)} />大文字小文字を無視（i）
                    </label>
                  </div>
                  {/* ウィザード（かんたん作成） */}
                  <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 rounded-md p-3">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">かんたん作成</div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-600" onClick={()=>setRegex('/バグ|bug/i')}>バグ系</button>
                      <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-600" onClick={()=>setRegex('title:/^feat:/i')}>featで始まる</button>
                      <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-600" onClick={()=>setRegex('title:/\.md$/i')}>.mdで終わる</button>
                      <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-600" onClick={()=>{ setRegex('tags:/\\b(backend|api)\\b/i'); setRegexFields(prev=> Array.from(new Set([...prev, 'tags']))) }}>タグ backend|api</button>
                      <button type="button" className="px-2 py-1 text-xs border rounded hover:bg-gray-100 dark:hover:bg-gray-600" onClick={()=>setRegex('description:/\\bPR-\\d{3,5}\\b/')}>PR-数値</button>
                    </div>
                  </div>
                  {/* プレビューと検証 */}
                  <div className="mt-2 text-xs">
                    {regexError ? (
                      <div className="text-red-600 dark:text-red-400">{regexError}</div>
                    ) : (
                      <div className="text-green-700 dark:text-green-300">OK: この式で検索します</div>
                    )}
                    <div className="text-gray-500 dark:text-gray-400 mt-1 break-all">送信例: regex={regex || '(未入力)'}{regexFields?.length ? `  fields=${regexFields.join(',')}` : ''}</div>
                  </div>
                </div>
                {/* ステータス複数 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">ステータス（複数選択）</label>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-700 dark:text-gray-300">
                    {['TODO','IN_PROGRESS','REVIEW','DONE'].map(s => (
                      <label key={s} className="inline-flex items-center gap-1"><input type="checkbox" checked={statusMulti.includes(s)} onChange={(e)=>setStatusMulti(prev => e.target.checked ? [...prev, s] : prev.filter(x=>x!==s))} />{s}</label>
                    ))}
                  </div>
                </div>
                {/* カスタム期間 */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">期間（カスタム・任意）</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={dateFrom} onChange={(e)=>setDateFrom(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                    <input type="date" value={dateTo} onChange={(e)=>setDateTo(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white" />
                  </div>
                </div>
                {/* 重みプリセット */}
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">重みプリセット</label>
                  <select value={weightPreset} onChange={(e)=>setWeightPreset(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white">
                    <option value="default">デフォルト</option>
                    <option value="urgent_first">緊急重視</option>
                    <option value="due_soon_first">期限重視</option>
                    <option value="title_exact_first">タイトル厳密一致重視</option>
                  </select>
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
  }, advanced?: Record<string, string>) => void
  className?: string
}

export default function DashboardHeader({ onModalSearch, className }: DashboardHeaderProps) {
  const { data: session } = useSession()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  // 認証されていない場合でもヘッダーを表示（検索機能は無効）
  const isAuthenticated = !!session?.user

  const triggerNewTodo = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('todo:new'))
    }
  }

  const handleSearch = (filters: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }, advanced?: Record<string, string>) => {
    // モーダルからの検索処理を親コンポーネントに委譲
    if (onModalSearch && isAuthenticated) {
      onModalSearch(filters, advanced)
    }
  }

  // グローバルイベントで検索モーダルを開く（TodoList側の "/" ショートカットから呼ばれる）
  React.useEffect(() => {
    const openHandler = () => {
      if (session?.user) setIsSearchModalOpen(true)
    }
    window.addEventListener('search:open', openHandler)
    return () => window.removeEventListener('search:open', openHandler)
  }, [session?.user])

  const headerClassName = [
    'flex items-center justify-between gap-4 px-5 py-4 rounded-3xl border border-slate-200 bg-white/95 backdrop-blur transition-colors',
    'shadow-[0_18px_48px_rgba(15,23,42,0.08)] dark:border-slate-800/70 dark:bg-slate-900/70 dark:shadow-slate-950/40',
    className || '',
  ].join(' ').trim()

  return (
    <>
      <header className={headerClassName}>
        <div className="flex items-center min-w-0 gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-200/60 dark:shadow-blue-900/40">
            <Image src="/icons/favicon.svg" alt="My Todo" width={26} height={26} className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500 leading-tight dark:text-slate-400">ようこそ戻りました</p>
            <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate dark:text-slate-100">
              {isAuthenticated ? `${session?.user?.name ?? 'あなた'}のワークスペース` : 'My Todo ワークスペース'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated && (
            <button 
              onClick={() => setIsSearchModalOpen(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors text-sm font-medium dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              title="Todo検索"
            >
              🔍
              <span>検索</span>
            </button>
          )}
          {isAuthenticated && (
            <button
              onClick={triggerNewTodo}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-500 hover:to-indigo-600 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-200/60 dark:shadow-blue-900/40"
            >
              ✚ 新規タスク
            </button>
          )}
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                  unoptimized
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                  {(session.user.name || session.user.email || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
              <Link
                href="/settings"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ⚙️ 設定
              </Link>
              <button
                onClick={() => signOut()}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors dark:hover:text-red-300"
              >
                ログアウト
              </button>
            </div>
          )}
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
