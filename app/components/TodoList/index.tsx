'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Priority, Status } from '@prisma/client'
import type { Todo, CreateTodoData, TodoFilters } from '@/types/todo'
import { Toaster } from 'react-hot-toast'

// フックのインポート
import { useTodoOperations } from './hooks/useTodoOperations'
import { useTodoBulkActions } from './hooks/useTodoBulkActions'
import { useTodoFilters } from './hooks/useTodoFilters'
import { useTodoSorting } from './hooks/useTodoSorting'
import { useDeadlineNotifications } from '@/app/hooks/useDeadlineNotifications'
import { usePageMovementDebugger } from '@/app/hooks/usePageMovementDebugger'

// コンポーネントのインポート
import TodoForm from '../TodoForm'
import TodoItem from '../TodoItem'
import TodoBulkActions from './TodoBulkActions'
import TodoCalendarView from './TodoCalendarView'
import TodoStatusView from './TodoStatusView'
import TodoKanbanView from './TodoKanbanView'
import EmptyState from './EmptyState'
import ProgressCelebration from './ProgressCelebration'
import XStyleContainer from './XStyleContainer'
import XStyleTodoCard from './XStyleTodoCard'
import XStyleTabs from './XStyleTabs'
import XStyleFAB from './XStyleFAB'
import XStyleSortBar from './XStyleSortBar'
import XStyleBulkActions from './XStyleBulkActions'

// 優先度の日本語ラベル
const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

// ステータス関連のヘルパー関数（現在は未使用だが将来的に使用予定）
// const getStatusLabel = (status: Status): string => {
//   switch (status) {
//     case 'TODO': return '📝 未着手'
//     case 'IN_PROGRESS': return '🔄 作業中'
//     case 'REVIEW': return '👀 確認中'
//     case 'DONE': return '✅ 完了'
//     default: return '❓ 不明'
//   }
// }

const getNextStatus = (currentStatus: Status): Status => {
  switch (currentStatus) {
    case 'TODO': return 'IN_PROGRESS'
    case 'IN_PROGRESS': return 'REVIEW'
    case 'REVIEW': return 'DONE'
    case 'DONE': return 'TODO'
    default: return 'TODO'
  }
}

interface TodoListProps {
  modalSearchValues?: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }
  advancedSearchParams?: Record<string, string>
}

/**
 * リファクタリングされたTodoリストコンテナコンポーネント
 *
 * 主要な機能:
 * - CRUD操作（useTodoOperations）
 * - 一括操作（useTodoBulkActions）
 * - フィルタリング（useTodoFilters）
 * - ソート機能（useTodoSorting）
 * - 複数のビュー（リスト、ステータス、カレンダー、かんばん）
 */
export default function TodoList({ modalSearchValues }: TodoListProps) {
  // デバッグ用ページ移動監視
  usePageMovementDebugger()

  // Todo操作フック
  const {
    todos,
    setTodos,
    isLoading,
    isSubmitting,
    fetchTodos,
    fetchTodosSWRFast,
    handleCreateTodo,
    handleUpdateTodo,
    handleDeleteTodo,
  } = useTodoOperations()

  // フィルタリングフック
  const { filter, setFilter, filteredTodos } = useTodoFilters({ todos })

  // ソート機能フック
  const { sortBy, setSortBy, sortOrder, setSortOrder, sortTodos } = useTodoSorting()

  // バルク操作フック
  const bulkActions = useTodoBulkActions({ todos, setTodos, fetchTodos })

  // UI状態管理
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [activeView, setActiveView] = useState<'all' | 'status' | 'calendar' | 'kanban'>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [useXStyle] = useState(true) // X風UIを使用するかどうか
  const [showNewTodoForm, setShowNewTodoForm] = useState(false)

  useEffect(() => {
    const openNewTodo = () => setShowNewTodoForm(true)
    if (typeof window !== 'undefined') {
      window.addEventListener('todo:new', openNewTodo)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('todo:new', openNewTodo)
      }
    }
  }, [])

  // インライン入力用のstate
  const [_showInlineInput, _setShowInlineInput] = useState(false)
  const [inlineInputValue, setInlineInputValue] = useState('')
  const [showDetailedForm, setShowDetailedForm] = useState(false)
  const [inlineFormData, setInlineFormData] = useState<Partial<CreateTodoData>>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    dueDate: undefined,
    category: '',
    tags: []
  })
  const inlineInputRef = useRef<HTMLInputElement>(null)
  const _newFormRef = useRef<HTMLInputElement | null>(null)

  // 通知設定
  const [notifyMinutes, setNotifyMinutes] = useState<number>(15)
  useEffect(() => {
    try {
      const m = localStorage.getItem('notify:deadline:minutes')
      if (m) setNotifyMinutes(Math.max(1, parseInt(m)))
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'notify:deadline:minutes' && e.newValue) {
        setNotifyMinutes(Math.max(1, parseInt(e.newValue)))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const { enabled: _deadlineNotifyEnabled, requestPermission: _requestDeadlinePermission } =
    useDeadlineNotifications(todos, { minutesBefore: notifyMinutes, intervalMs: 60_000 })

  // 通知からのディープリンク対応
  const lastFocusedRef = useRef<string | null>(null)
  const focusTodoById = useCallback((id: string, maxAttempts = 30, interval = 100) => {
    let attempts = 0
    const tryOnce = () => {
      attempts++
      const sel = `[data-todo-id="${CSS.escape(id)}"]`
      const el = document.querySelector(sel) as HTMLElement | null
      if (el) {
        try {
          el.scrollIntoView({ behavior: attempts <= 2 ? 'auto' : 'smooth', block: 'center' })
          const origOutline = el.style.outline
          el.style.outline = '3px solid #facc15'
          el.style.outlineOffset = '2px'
          setTimeout(() => {
            el.style.outline = origOutline
            el.style.outlineOffset = ''
          }, 1600)
          lastFocusedRef.current = id
          try {
            const sp = new URLSearchParams(window.location.search)
            if (sp.get('focus') === id) {
              sp.delete('focus')
              const newUrl = window.location.pathname + (sp.toString() ? `?${sp.toString()}` : '')
              window.history.replaceState(null, '', newUrl)
            }
          } catch {}
          return true
        } catch { /* ignore */ }
      }
      if (attempts < maxAttempts) {
        setTimeout(tryOnce, interval)
      }
      return false
    }
    return tryOnce()
  }, [])

  const scheduleFocusFromURL = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const focusId = sp.get('focus')
      if (focusId && focusId !== lastFocusedRef.current) {
        focusTodoById(focusId)
      }
    } catch {}
  }, [focusTodoById])

  useEffect(() => {
    if (typeof window === 'undefined') return
    scheduleFocusFromURL()
  }, [todos, scheduleFocusFromURL])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => scheduleFocusFromURL()
    const onMsg = (e: MessageEvent) => {
      try {
        if (e && e.data && e.data.type === 'focus-todo' && e.data.todoId) {
          focusTodoById(String(e.data.todoId))
        }
      } catch {}
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('message', onMsg)
    }
  }, [focusTodoById, scheduleFocusFromURL])

  // モーダルからの検索値をフィルターに反映
  useEffect(() => {
    if (modalSearchValues) {
      const newFilter: TodoFilters = {
        search: modalSearchValues.keyword || '',
        category: modalSearchValues.category || '',
        tags: modalSearchValues.tags.length > 0 ? modalSearchValues.tags : undefined,
        completed: modalSearchValues.completed,
        priority: modalSearchValues.priority as Priority | undefined,
        dateRange: (modalSearchValues.dateRange as TodoFilters['dateRange']) || undefined
      }

      Object.keys(newFilter).forEach(key => {
        const value = newFilter[key as keyof TodoFilters]
        if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
          delete newFilter[key as keyof TodoFilters]
        }
      })

      console.log('🔍 モーダル検索値をフィルターに反映:', newFilter)
      setFilter(newFilter)
    }
  }, [modalSearchValues, setFilter])

  // 初回データ取得
  useEffect(() => {
    fetchTodosSWRFast()
  }, [fetchTodosSWRFast])

  // ドラッグ&ドロップハンドラー
  const handleDragStart = useCallback((e: React.DragEvent, todo: Todo) => {
    try {
      setDraggedTodo(todo)
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', todo.id)
      }
      const target = e.currentTarget as HTMLElement
      if (target) {
        target.classList.add('opacity-50')
      }
      console.log('🎨 ドラッグ開始:', { todoId: todo.id, title: todo.title })
    } catch (error) {
      console.error('❌ ドラッグスタートエラー:', error)
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    try {
      setDraggedTodo(null)
      setDragOverColumn(null)
      const target = e.currentTarget as HTMLElement
      if (target) {
        target.classList.remove('opacity-50')
      }
      console.log('🏁 ドラッグ終了')
    } catch (error) {
      console.error('❌ ドラッグエンドエラー:', error)
      setDraggedTodo(null)
      setDragOverColumn(null)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, status: Status) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      setDragOverColumn(status)
    } catch (error) {
      console.error('❌ ドラッグオーバーエラー:', error)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if ((e.target as Element).closest('[data-drop-zone="true"]') === e.currentTarget) {
      return
    }
    setDragOverColumn(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetStatus: Status) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      setDragOverColumn(null)

      if (!draggedTodo) {
        console.warn('⚠️ ドラッグ中のTodoが見つかりません')
        return
      }

      if (draggedTodo.status === targetStatus) {
        console.log('🚀 同じステータスのためスキップ:', targetStatus)
        return
      }

      console.log('🎯 ドラッグ&ドロップ:', {
        todoId: draggedTodo.id,
        from: draggedTodo.status,
        to: targetStatus
      })

      handleUpdateTodo(draggedTodo.id, { status: targetStatus })
      setDraggedTodo(null)
    } catch (error) {
      console.error('❌ ドラッグ&ドロップエラー:', error)
      setDraggedTodo(null)
      setDragOverColumn(null)
    }
  }, [draggedTodo, handleUpdateTodo])

  // インライン入力ハンドラー
  const _handleInlineInputKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (inlineInputValue.trim()) {
        if (e.shiftKey) {
          handleShowDetailedForm()
        } else {
          await handleCreateInlineTodo()
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelInlineInput()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleShowDetailedForm()
    }
  }

  const handleCreateInlineTodo = async () => {
    const title = showDetailedForm ? inlineFormData.title : inlineInputValue.trim()
    if (!title) return

    try {
      const todoData = showDetailedForm ? {
        title: title,
        description: inlineFormData.description || '',
        priority: inlineFormData.priority || 'MEDIUM',
        dueDate: inlineFormData.dueDate || undefined,
        category: inlineFormData.category || '',
        tags: inlineFormData.tags || []
      } : {
        title: title,
        description: '',
        priority: 'MEDIUM' as Priority,
        dueDate: undefined,
        category: '',
        tags: []
      }

      await handleCreateTodo(todoData)
      handleCancelInlineInput()
    } catch (error) {
      console.error('インライン入力でのTodo作成エラー:', error)
    }
  }

  const handleShowDetailedForm = () => {
    setInlineFormData(prev => ({
      ...prev,
      title: inlineInputValue.trim()
    }))
    setShowDetailedForm(true)
  }

  const handleCancelInlineInput = () => {
    setInlineInputValue('')
    _setShowInlineInput(false)
    setShowDetailedForm(false)
    setInlineFormData({
      title: '',
      description: '',
      priority: 'MEDIUM',
      dueDate: undefined,
      category: '',
      tags: []
    })
  }

  const _handleShowInlineInput = () => {
    _setShowInlineInput(true)
    setTimeout(() => {
      inlineInputRef.current?.focus()
    }, 0)
  }

  const _handleInlineFormChange = (field: keyof CreateTodoData, value: string | Priority | Date | string[] | undefined) => {
    setInlineFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleEditSubmit = async (data: CreateTodoData) => {
    if (!editingTodo) return
    try {
      await handleUpdateTodo(editingTodo.id, data)
      setEditingTodo(null)
    } catch (error) {
      console.error('編集エラー:', error)
    }
  }

  // ソート済みのTodoリスト
  const sortedTodos = sortTodos(filteredTodos)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  // X風のレンダリング
  if (useXStyle) {
    return (
      <>
        <Toaster position="top-right" />
        <XStyleContainer>
          {/* タブナビゲーション */}
          <XStyleTabs
            activeView={activeView}
            onViewChange={setActiveView}
            counts={{
              all: filteredTodos.length,
              status: filteredTodos.length,
              calendar: filteredTodos.filter(t => t.dueDate).length,
              kanban: filteredTodos.length,
            }}
          />

          {/* ソートバー */}
          <XStyleSortBar
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={setSortBy}
            onSortOrderChange={setSortOrder}
          />

          <XStyleBulkActions
            isSelectionMode={bulkActions.isSelectionMode}
            selectedCount={bulkActions.selectedTodos.size}
            totalCount={sortedTodos.length}
            isBulkOperating={bulkActions.isBulkOperating}
            onToggleSelection={bulkActions.toggleSelectionMode}
            onSelectAll={() => bulkActions.handleSelectAll(sortedTodos)}
            onBulkStatusUpdate={bulkActions.handleBulkStatusUpdate}
            onBulkDelete={bulkActions.handleBulkDelete}
          />

          {/* メインコンテンツ */}
          {activeView === 'all' && (
            <div>
              {/* 進捗表示 */}
              {todos.length > 0 && !Object.keys(filter).length && (
                <div className="p-4 border-b border-gray-200 dark:border-gray-800">
                  <ProgressCelebration
                    totalTodos={todos.length}
                    completedTodos={todos.filter(t => t.status === 'DONE').length}
                  />
                </div>
              )}

              {/* タスクリスト */}
              {sortedTodos.length === 0 ? (
                <EmptyState
                  viewType="all"
                  hasAnyTodos={todos.length > 0}
                  isFiltered={Object.keys(filter).length > 0}
                />
              ) : (
                <div>
                  {sortedTodos.map((todo) => (
                    <XStyleTodoCard
                      key={todo.id}
                      todo={todo}
                      onUpdate={handleUpdateTodo}
                      onDelete={handleDeleteTodo}
                      onEdit={setEditingTodo}
                      isSelectionMode={bulkActions.isSelectionMode}
                      isSelected={bulkActions.selectedTodos.has(todo.id)}
                      onSelect={bulkActions.handleSelectTodo}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeView === 'status' && (
            <div className="p-4">
              <TodoStatusView
                filteredTodos={filteredTodos}
                sortTodos={sortTodos}
                setEditingTodo={setEditingTodo}
              />
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="p-4">
              <TodoCalendarView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                filteredTodos={filteredTodos}
                setEditingTodo={setEditingTodo}
              />
            </div>
          )}

          {activeView === 'kanban' && (
            <div className="p-4">
              <TodoKanbanView
                filteredTodos={filteredTodos}
                draggedTodo={draggedTodo}
                dragOverColumn={dragOverColumn}
                setEditingTodo={setEditingTodo}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleDragOver={handleDragOver}
                handleDragLeave={handleDragLeave}
                handleDrop={handleDrop}
                handleUpdateTodo={handleUpdateTodo}
                getNextStatus={getNextStatus}
                PRIORITY_LABELS={PRIORITY_LABELS}
              />
            </div>
          )}

          {/* フローティングアクションボタン */}
          <XStyleFAB onClick={() => setShowNewTodoForm(true)} />

          {/* 新規タスクフォーム（モーダル） */}
          {(showNewTodoForm || editingTodo) && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editingTodo ? 'タスクを編集' : '新しいタスク'}
                    </h2>
                    <button
                      onClick={() => {
                        setShowNewTodoForm(false)
                        setEditingTodo(null)
                      }}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  {editingTodo ? (
                    <TodoForm
                      key={editingTodo.id}
                      initialData={{
                        title: editingTodo.title,
                        description: editingTodo.description || '',
                        priority: editingTodo.priority,
                        status: editingTodo.status,
                        dueDate: editingTodo.dueDate,
                        category: editingTodo.category,
                        tags: editingTodo.tags,
                      }}
                      onSubmit={handleEditSubmit}
                      onCancel={() => setEditingTodo(null)}
                      isLoading={isSubmitting}
                    />
                  ) : (
                    <TodoForm
                      onSubmit={(data) => {
                        handleCreateTodo(data)
                        setShowNewTodoForm(false)
                      }}
                      isLoading={isSubmitting}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </XStyleContainer>
      </>
    )
  }

  // 従来のUIレンダリング
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* バルク操作UI */}
      {(bulkActions.isSelectionMode || bulkActions.selectedTodos.size > 0) && (
        <TodoBulkActions
          isSelectionMode={bulkActions.isSelectionMode}
          selectedTodos={bulkActions.selectedTodos}
          isBulkOperating={bulkActions.isBulkOperating}
          filteredTodosLength={filteredTodos.length}
          toggleSelectionMode={bulkActions.toggleSelectionMode}
          handleSelectAll={() => bulkActions.handleSelectAll(filteredTodos)}
          handleBulkStatusUpdate={bulkActions.handleBulkStatusUpdate}
          handleBulkDelete={bulkActions.handleBulkDelete}
        />
      )}

      {/* タブビュー */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* タブヘッダー */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'all', label: '📋 すべて', icon: '📋', tooltip: 'すべてのタスクを一覧表示' },
            { id: 'status', label: '📊 ステータス別', icon: '📊', tooltip: 'ステータス別の進捗を確認' },
            { id: 'calendar', label: '📅 カレンダー', icon: '📅', tooltip: '期限をカレンダーで確認' },
            { id: 'kanban', label: '🗂️ かんばん', icon: '🗂️', tooltip: 'ドラッグ&ドロップで管理' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as typeof activeView)}
              title={view.tooltip}
              className={`group flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 relative ${
                activeView === view.id
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:scale-105'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-base transition-transform group-hover:scale-110">{view.icon}</span>
                <span className="hidden sm:inline">{view.label.split(' ')[1]}</span>
              </span>
              {activeView === view.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400"></div>
              )}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="p-4">
          {activeView === 'all' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  📋 全てのタスク
                </h3>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">並び順:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'dueDate' | 'priority')}
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="createdAt">📅 作成日時</option>
                      <option value="dueDate">⏰ 期限日</option>
                      <option value="priority">⚡ 優先度</option>
                    </select>
                  </div>

                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-xs px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                  >
                    {sortOrder === 'desc' ? <>🔽 新しい順</> : <>🔼 古い順</>}
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                {filteredTodos.length}件のTodoを
                {sortBy === 'createdAt' && '作成日時'}
                {sortBy === 'dueDate' && '期限日'}
                {sortBy === 'priority' && '優先度'}
                の{sortOrder === 'desc' ? '降順' : '昇順'}で表示
              </div>

              {/* 進捗表示 */}
              {todos.length > 0 && (
                <ProgressCelebration
                  totalTodos={todos.length}
                  completedTodos={todos.filter(t => t.status === 'DONE').length}
                />
              )}

              {/* Todoリスト */}
              <div className="space-y-3">
                {sortedTodos.length === 0 ? (
                  <EmptyState
                    viewType="all"
                    hasAnyTodos={todos.length > 0}
                    isFiltered={Object.keys(filter).length > 0}
                  />
                ) : (
                  sortedTodos.map((todo) => (
                    <TodoItem
                      key={todo.id}
                      todo={todo}
                      onUpdate={handleUpdateTodo}
                      onDelete={handleDeleteTodo}
                      onEdit={setEditingTodo}
                      isSelectionMode={bulkActions.isSelectionMode}
                      isSelected={bulkActions.selectedTodos.has(todo.id)}
                      onSelect={bulkActions.handleSelectTodo}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {activeView === 'status' && (
            <TodoStatusView
              filteredTodos={filteredTodos}
              sortTodos={sortTodos}
              setEditingTodo={setEditingTodo}
            />
          )}

          {activeView === 'calendar' && (
            <TodoCalendarView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              filteredTodos={filteredTodos}
              setEditingTodo={setEditingTodo}
            />
          )}

          {activeView === 'kanban' && (
            <TodoKanbanView
              filteredTodos={filteredTodos}
              draggedTodo={draggedTodo}
              dragOverColumn={dragOverColumn}
              setEditingTodo={setEditingTodo}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleUpdateTodo={handleUpdateTodo}
              getNextStatus={getNextStatus}
              PRIORITY_LABELS={PRIORITY_LABELS}
            />
          )}
        </div>
      </div>

      {/* Todoフォーム */}
      {editingTodo ? (
        <TodoForm
          key={editingTodo.id}
          initialData={{
            title: editingTodo.title,
            description: editingTodo.description || '',
            priority: editingTodo.priority,
            status: editingTodo.status,
            dueDate: editingTodo.dueDate,
            category: editingTodo.category,
            tags: editingTodo.tags,
          }}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditingTodo(null)}
          isLoading={isSubmitting}
        />
      ) : (
        <TodoForm
          onSubmit={handleCreateTodo}
          isLoading={isSubmitting}
        />
      )}

      {/* バルク操作モード切り替えボタン */}
      {!bulkActions.isSelectionMode && filteredTodos.length > 0 && (
        <div className="flex justify-center animate-fade-in">
          <button
            onClick={bulkActions.toggleSelectionMode}
            className="group px-6 py-3 text-sm font-medium bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30 text-purple-700 dark:text-purple-300 rounded-xl hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-900/50 dark:hover:to-blue-900/50 transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2"
          >
            <span className="transition-transform group-hover:scale-110">✨</span>
            <span>複数のタスクを一括操作</span>
            <span className="text-xs opacity-75">(選択モード)</span>
          </button>
        </div>
      )}
    </div>
  )
}
