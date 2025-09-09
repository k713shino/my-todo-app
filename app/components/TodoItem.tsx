'use client'

import { useState, useCallback, memo, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import { Todo } from '@/types/todo'
import { safeParseDate, safeParseTodoDate } from '@/lib/date-utils'
// SubtaskManager は詳細モーダルを廃止したため未使用

/**
 * Todoアイテムコンポーネントのプロパティ定義
 *
 * @param todo 表示するTodoデータ
 * @param onUpdate 完了状態更新時のコールバック関数
 * @param onEdit 編集ボタンクリック時のコールバック関数
 * @param onDelete 削除ボタンクリック時のコールバック関数
 * @param isLoading ローディング状態を示すフラグ
 */
interface TodoItemProps {
  todo: Todo
  onUpdate: (id: string, data: { status?: Status; completed?: boolean }) => void
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => void
  isLoading?: boolean
  // バルク操作用
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: (todoId: string) => void
  // サブタスク用
  onSubtaskChange?: () => void
}

/**
 * 優先度の表示ラベル
 * データベース上の英語表記を日本語表示に変換
 */
const priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}

/**
 * 優先度ごとの表示色定義
 * Tailwindのユーティリティクラスを使用（ダークモード対応）
 */
const priorityColors = {
  LOW: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  MEDIUM: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  HIGH: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
  URGENT: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
}

/**
 * 優先度ごとのアイコン定義
 * 色付きの円で優先度を視覚的に表現
 */
const priorityIcons = {
  LOW: '🟢',
  MEDIUM: '🟡',
  HIGH: '🟠',
  URGENT: '🔴',
}

/**
 * ステータスの表示ラベル
 */
const statusLabels = {
  TODO: '📝 未着手',
  IN_PROGRESS: '🔄 作業中',
  REVIEW: '👀 確認中',
  DONE: '✅ 完了',
}

/**
 * ステータスごとの表示色定義
 */
const statusColors = {
  TODO: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700',
  IN_PROGRESS: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  REVIEW: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30',
  DONE: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
}

/**
 * ヘルパー関数：完了状態の判定
 */
const isCompleted = (status: Status): boolean => status === 'DONE'

/**
 * ヘルパー関数：次のステータスを取得
 */
const getNextStatus = (currentStatus: Status): Status => {
  switch (currentStatus) {
    case 'TODO': return 'IN_PROGRESS'
    case 'IN_PROGRESS': return 'REVIEW'
    case 'REVIEW': return 'DONE'
    case 'DONE': return 'TODO'
    default: return 'TODO'
  }
}

/**
 * 個別のTodoアイテムを表示するコンポーネント
 *
 * 機能:
 * - Todoの表示（タイトル、説明、優先度、期限など）
 * - 完了状態の切り替え
 * - 編集・削除機能
 * - 期限切れの表示
 * - ローディング状態の制御
 */
function TodoItem({
  todo, 
  onUpdate, 
  onEdit, 
  onDelete, 
  isLoading = false,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  onSubtaskChange
}: TodoItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isTracking, setIsTracking] = useState<boolean>(false)
  const [isSubtasksOpen, setIsSubtasksOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<Todo[] | null>(null)
  const [isSubtasksLoading, setIsSubtasksLoading] = useState(false)
  const [subtasksError, setSubtasksError] = useState<string | null>(null)
  const [updatingSubtaskId, setUpdatingSubtaskId] = useState<string | null>(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [isCreatingSubtask, setIsCreatingSubtask] = useState(false)
  const [deletingSubtaskId, setDeletingSubtaskId] = useState<string | null>(null)
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [editSubtaskTitle, setEditSubtaskTitle] = useState('')
  const [editSubtaskDue, setEditSubtaskDue] = useState('') // datetime-local 形式
  const [isSavingSubtask, setIsSavingSubtask] = useState(false)
  const [draggingSubtaskId, setDraggingSubtaskId] = useState<string | null>(null)
  const [dragOverSubtaskId, setDragOverSubtaskId] = useState<string | null>(null)

  /**
   * 期限切れ判定
   * - 期限が設定されている
   * - 未完了のタスク
   * - 現在時刻が期限を超えている
   */
  const isOverdue = todo.dueDate && !isCompleted(todo.status) &&
    isAfter(new Date(), todo.dueDate)

  /**
   * ステータス変更ハンドラー（ドロップダウンでは直接onUpdateを呼ぶため不要だが、一応残しておく）
   */
  const handleStatusChange = async () => {
    setIsUpdating(true)
    try {
      const nextStatus = getNextStatus(todo.status)
      await onUpdate(todo.id, { status: nextStatus })
    } finally {
      setIsUpdating(false)
    }
  }

  /**
   * 削除ハンドラー
   * - 削除前に確認ダイアログを表示
   * - 確認が取れたら削除を実行
   */
  const handleDelete = () => {
    if (confirm(`「${todo.title}」を削除してもよろしいですか？`)) {
      onDelete(todo.id)
    }
  }

  // === MVP: 時間計測（開始/停止） ===
  useEffect(() => {
    const read = () => {
      try {
        const runId = localStorage.getItem('time:runningTodoId')
        setIsTracking((runId ?? '') === String(todo.id))
      } catch {}
    }
    read()
    // グローバルイベントで同期
    const onSync = () => read()
    if (typeof window !== 'undefined') {
      window.addEventListener('time:runningChanged', onSync)
      window.addEventListener('todo:changed', onSync)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('time:runningChanged', onSync)
        window.removeEventListener('todo:changed', onSync)
      }
    }
  }, [todo.id])

  const startTracking = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoId: todo.id })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try { localStorage.setItem('time:runningTodoId', String(todo.id)) } catch {}
      setIsTracking(true)
      toast.success('⏱️ 計測を開始しました')
      try { 
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('time:runningChanged'))
          window.dispatchEvent(new CustomEvent('todo:changed'))
        }
      } catch {}
    } catch (e) {
      toast.error('計測開始に失敗しました')
    }
  }, [todo.id])

  const stopTracking = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/stop', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try { localStorage.removeItem('time:runningTodoId') } catch {}
      setIsTracking(false)
      toast('⏹️ 計測を停止しました')
      try { 
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('time:runningChanged'))
          window.dispatchEvent(new CustomEvent('todo:changed'))
        }
      } catch {}
    } catch (e) {
      toast.error('計測停止に失敗しました')
    }
  }, [])

  // サブタスク詳細モーダルは廃止

  // サブタスク取得
  const fetchSubtasks = useCallback(async () => {
    try {
      setIsSubtasksLoading(true)
      setSubtasksError(null)
      const res = await fetch(`/api/todos/${todo.id}/subtasks`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to fetch subtasks: ${res.status} ${text}`)
      }
      const data = await res.json()
      const parsed: Todo[] = Array.isArray(data)
        ? data.map((t: any) => safeParseTodoDate<Todo>(t))
        : []
      setSubtasks(parsed)
    } catch (e) {
      setSubtasksError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsSubtasksLoading(false)
    }
  }, [todo.id])

  // サブタスクのステータス更新（インライン）
  const updateSubtaskStatus = useCallback(async (subtaskId: string, currentStatus: Status) => {
    try {
      setUpdatingSubtaskId(subtaskId)
      const nextStatus = getNextStatus(currentStatus)
      const res = await fetch(`/api/todos/${subtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to update subtask: ${res.status} ${text}`)
      }
      const updated = safeParseTodoDate<Todo>(await res.json())
      setSubtasks(prev => prev ? prev.map(s => s.id === subtaskId ? updated : s) : prev)
      onSubtaskChange?.()
    } catch (e) {
      setSubtasksError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setUpdatingSubtaskId(null)
    }
  }, [onSubtaskChange])

  /**
   * サブタスク一覧の開閉・取得
   */
  const toggleSubtasks = useCallback(async () => {
    const nextOpen = !isSubtasksOpen
    setIsSubtasksOpen(nextOpen)
    if (nextOpen && subtasks === null) {
      await fetchSubtasks()
    }
  }, [isSubtasksOpen, subtasks, fetchSubtasks])

  // サブタスク作成（インライン）
  const createSubtask = useCallback(async () => {
    const title = newSubtaskTitle.trim()
    if (!title) return
    try {
      setIsCreatingSubtask(true)
      setSubtasksError(null)
      const res = await fetch(`/api/todos/${todo.id}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to create subtask: ${res.status} ${text}`)
      }
      const created = safeParseTodoDate<Todo>(await res.json())
      let nextList: Todo[] = []
      setSubtasks(prev => {
        nextList = prev ? [created, ...prev] : [created]
        return nextList
      })
      // 並び順保存（先頭に追加）
      try {
        const order = nextList.map(s => s.id)
        await fetch(`/api/todos/${todo.id}/subtasks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order })
        })
      } catch {}
      setNewSubtaskTitle('')
      onSubtaskChange?.()
    } catch (e) {
      setSubtasksError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsCreatingSubtask(false)
    }
  }, [newSubtaskTitle, todo.id, onSubtaskChange])

  // サブタスク削除（インライン）
  const deleteSubtask = useCallback(async (subtaskId: string) => {
    if (!confirm('このサブタスクを削除しますか？')) return
    try {
      setDeletingSubtaskId(subtaskId)
      const res = await fetch(`/api/todos/${subtaskId}`, { method: 'DELETE' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to delete subtask: ${res.status} ${text}`)
      }
      setSubtasks(prev => prev ? prev.filter(s => s.id !== subtaskId) : prev)
      // 並び順保存
      try {
        const order = (subtasks || []).filter(s => s.id !== subtaskId).map(s => s.id)
        await fetch(`/api/todos/${todo.id}/subtasks`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order })
        })
      } catch {}
      onSubtaskChange?.()
    } catch (e) {
      setSubtasksError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setDeletingSubtaskId(null)
    }
  }, [onSubtaskChange])

  // 並び替え保存
  const persistSubtaskOrder = useCallback(async (list: Todo[]) => {
    try {
      const order = list.map(s => s.id)
      await fetch(`/api/todos/${todo.id}/subtasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      })
    } catch (e) {
      // 非致命的
      console.warn('サブタスク順序保存に失敗:', e)
    }
  }, [todo.id])

  // DnD: drag開始
  const onDragStartSub = (e: React.DragEvent, subId: string) => {
    setDraggingSubtaskId(subId)
    e.dataTransfer.effectAllowed = 'move'
  }
  // DnD: drag over
  const onDragOverSub = (e: React.DragEvent, overId: string) => {
    e.preventDefault()
    if (dragOverSubtaskId !== overId) setDragOverSubtaskId(overId)
  }
  // DnD: dropで順序更新
  const onDropSub = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!subtasks || !draggingSubtaskId || draggingSubtaskId === targetId) {
      setDraggingSubtaskId(null)
      setDragOverSubtaskId(null)
      return
    }
    const srcIndex = subtasks.findIndex(s => s.id === draggingSubtaskId)
    const dstIndex = subtasks.findIndex(s => s.id === targetId)
    if (srcIndex < 0 || dstIndex < 0) {
      setDraggingSubtaskId(null)
      setDragOverSubtaskId(null)
      return
    }
    const next = [...subtasks]
    const [moved] = next.splice(srcIndex, 1)
    next.splice(dstIndex, 0, moved)
    setSubtasks(next)
    await persistSubtaskOrder(next)
    onSubtaskChange?.()
    setDraggingSubtaskId(null)
    setDragOverSubtaskId(null)
  }
  // DnD: drag end
  const onDragEndSub = () => {
    setDraggingSubtaskId(null)
    setDragOverSubtaskId(null)
  }

  // Date -> datetime-local 変換 (ローカルタイム)
  const toDatetimeLocalValue = (date: Date | null | undefined): string => {
    if (!date) return ''
    const pad = (n: number) => n.toString().padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const hh = pad(date.getHours())
    const mm = pad(date.getMinutes())
    return `${y}-${m}-${d}T${hh}:${mm}`
  }

  // 編集開始
  const startEditSubtask = (s: Todo) => {
    setEditingSubtaskId(s.id)
    setEditSubtaskTitle(s.title)
    setEditSubtaskDue(toDatetimeLocalValue(s.dueDate || null))
  }

  // 編集キャンセル
  const cancelEditSubtask = () => {
    setEditingSubtaskId(null)
    setEditSubtaskTitle('')
    setEditSubtaskDue('')
  }

  // 編集保存
  const saveEditSubtask = async () => {
    if (!editingSubtaskId) return
    try {
      setIsSavingSubtask(true)
      const payload: any = {}
      payload.title = editSubtaskTitle.trim()
      // due: 空なら null を送る
      if (editSubtaskDue === '') {
        payload.dueDate = null
      } else {
        // datetime-local はローカル時刻。ISOにして送る。
        const dt = new Date(editSubtaskDue)
        if (!isNaN(dt.getTime())) {
          payload.dueDate = dt.toISOString()
        }
      }
      const res = await fetch(`/api/todos/${editingSubtaskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to update subtask: ${res.status} ${text}`)
      }
      const updated = safeParseTodoDate<Todo>(await res.json())
      setSubtasks(prev => prev ? prev.map(s => s.id === editingSubtaskId ? updated : s) : prev)
      onSubtaskChange?.()
      cancelEditSubtask()
    } catch (e) {
      setSubtasksError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsSavingSubtask(false)
    }
  }

  // デバッグ: サブタスク数をログ出力
  console.log('TodoItem デバッグ:', { 
    id: todo.id, 
    title: todo.title, 
    hasCount: !!todo._count, 
    subtasks: todo._count?.subtasks,
    hasSubtasks: todo._count?.subtasks && todo._count.subtasks > 0
  })

  return (
    <>
      <div data-todo-id={todo.id} id={`todo-${todo.id}`} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/20 p-3 sm:p-4 border-l-4 transition-all duration-200 ${
        isCompleted(todo.status)
          ? 'border-green-400 dark:border-green-500 opacity-75' 
          : isOverdue 
          ? 'border-red-400 dark:border-red-500' 
          : todo.status === 'IN_PROGRESS'
          ? 'border-blue-400 dark:border-blue-500'
          : todo.status === 'REVIEW'
          ? 'border-yellow-400 dark:border-yellow-500'
          : 'border-gray-400 dark:border-gray-500'
      } ${isUpdating ? 'opacity-50' : ''}`}>
        
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
            {/* バルク選択チェックボックス */}
            {isSelectionMode && (
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelect?.(todo.id)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className={`text-sm sm:text-lg font-medium break-words ${
                    isCompleted(todo.status) ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    <span className="mr-1">{priorityIcons[todo.priority]}</span>
                    {todo.title}
                  </h3>
                </div>
                
                {/* ステータスドロップダウン */}
                <div className="flex-shrink-0">
                  <select
                    value={todo.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as Status
                      if (newStatus !== todo.status) {
                        onUpdate(todo.id, { status: newStatus })
                      }
                    }}
                    disabled={isLoading || isUpdating}
                    className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 ${statusColors[todo.status]} ${
                      isLoading || isUpdating ? 'cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-1 sm:space-x-2 flex-shrink-0 ml-2">
            {/* 時間追跡ボタン - 改善されたUI */}
            <button
              onClick={() => (isTracking ? stopTracking() : startTracking())}
              disabled={isLoading}
              className={`relative transition-all duration-200 p-2 rounded-full min-w-[36px] min-h-[36px] flex items-center justify-center ${
                isTracking 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 shadow-sm' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 shadow-sm'
              } ${isTracking ? 'animate-pulse' : ''}`}
              title={isTracking ? '⏹️ 時間計測を停止' : '▶️ 時間計測を開始'}
            >
              <span className="text-sm font-medium">
                {isTracking ? '⏹️' : '▶️'}
              </span>
              {/* 計測中の視覚的インジケーター */}
              {isTracking && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
              )}
            </button>
            <button
              onClick={() => onEdit(todo)}
              disabled={isLoading}
              className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1 sm:p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="編集"
            >
              <span className="text-base sm:text-lg">✏️</span>
            </button>
            {/* サブタスク詳細ボタンは廃止 */}
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 sm:p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="削除"
            >
              <span className="text-base sm:text-lg">🗑️</span>
            </button>
          </div>
        </div>

        {/* 説明 */}
        {todo.description && (
          <p className={`text-sm mb-3 break-words ${
            isCompleted(todo.status) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'
          }`}>
            {todo.description}
          </p>
        )}

        {/* メタ情報 */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
          {/* 優先度 */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[todo.priority]}`}>
            {priorityLabels[todo.priority]}
          </span>

          {/* サブタスク ロールアップ（件数/進捗）*/}
          {!todo.parentId && (todo.rollup?.total ?? 0) > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1">
              📋 {todo.rollup?.done ?? 0} / {todo.rollup?.total ?? 0}
              <span className="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden inline-flex">
                <span
                  className="bg-green-500 h-1"
                  style={{ width: `${Math.min(100, Math.max(0, todo.rollup?.percent ?? 0))}%` }}
                />
              </span>
            </span>
          )}

          {/* 期限 */}
          {todo.dueDate && (
            <span className={`text-xs break-words ${
              isOverdue && !isCompleted(todo.status)
                ? 'text-red-600 dark:text-red-400 font-medium' 
                : isCompleted(todo.status)
                ? 'text-gray-400 dark:text-gray-500' 
                : 'text-gray-600 dark:text-gray-300'
            }`}>
              📅 <span className="hidden sm:inline">{format(todo.dueDate, 'yyyy年M月d日 HH:mm', { locale: ja })}</span>
              <span className="sm:hidden">{format(todo.dueDate, 'M/d HH:mm', { locale: ja })}</span>
              {isOverdue && !isCompleted(todo.status) && ' (期限切れ)'}
            </span>
          )}

          {/* 作成日 - デスクトップのみ表示 */}
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">
            作成: {format(todo.createdAt, 'M月d日 HH:mm', { locale: ja })}
          </span>
        </div>

        {/* カテゴリ・タグ - 常時表示 */}
        <div className="text-sm text-gray-500 mt-2 space-y-1">
          {/* カテゴリ */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">カテゴリ:</span>
            <span className="text-xs sm:text-sm break-words">
              {todo.category || 'なし'}
            </span>
          </div>
          {/* タグ */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs sm:text-sm">タグ:</span>
            {todo.tags && todo.tags.length > 0 ? (
              todo.tags.map((tag, index) => (
                <span key={index} className="text-blue-600 dark:text-blue-400 text-xs sm:text-sm break-words">
                  #{tag}
                </span>
              ))
            ) : (
              <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500">なし</span>
            )}
          </div>
        </div>

        {/* サブタスク表示 */}
        {/* 親タスクであればサブタスクセクションを表示（0件でも展開可能） */}
        {!todo.parentId && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <button 
              type="button"
              onClick={toggleSubtasks}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📋 サブタスク ({(subtasks?.length ?? todo._count?.subtasks ?? 0)}件)
              </span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">
                {isSubtasksOpen ? '▲ 閉じる' : '▼ 開く'}
              </span>
            </button>
            
            {/* サブタスクの進捗バー（開いている時のみ表示） */}
            {isSubtasksOpen && (subtasks && subtasks.length > 0) && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${(subtasks.filter(s => isCompleted(s.status)).length / subtasks.length) * 100}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {subtasks.filter(s => isCompleted(s.status)).length} / {subtasks.length} 完了
                </div>
              </div>
            )}

            {/* サブタスク一覧 */}
            {isSubtasksOpen && (
              <div className="mt-3">
                {/* 追加フォーム */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createSubtask()}
                    placeholder="新しいサブタスクのタイトル..."
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                  />
                  <button
                    onClick={createSubtask}
                    disabled={isCreatingSubtask || !newSubtaskTitle.trim()}
                    className="text-xs px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingSubtask ? '作成中...' : '追加'}
                  </button>
                </div>
                {isSubtasksLoading && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">読み込み中...</div>
                )}
                {subtasksError && (
                  <div className="text-xs text-red-600 dark:text-red-400">{subtasksError}</div>
                )}
                {subtasks && subtasks.length === 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">サブタスクはありません。</div>
                )}
                {subtasks && subtasks.length > 0 && (
                  <ul className="space-y-2">
                    {subtasks.map((s) => {
                      const overdue = s.dueDate && !isCompleted(s.status) && isAfter(new Date(), s.dueDate)
                      return (
                        <li
                          key={s.id}
                          className={`flex items-start justify-between bg-gray-50 dark:bg-gray-900/30 rounded px-2 py-2 ${dragOverSubtaskId === s.id ? 'ring-2 ring-purple-400' : ''}`}
                          draggable
                          onDragStart={(e) => onDragStartSub(e, s.id)}
                          onDragOver={(e) => onDragOverSub(e, s.id)}
                          onDrop={(e) => onDropSub(e, s.id)}
                          onDragEnd={onDragEndSub}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            {editingSubtaskId === s.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editSubtaskTitle}
                                  onChange={(e) => setEditSubtaskTitle(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                                  placeholder="タイトル"
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    type="datetime-local"
                                    value={editSubtaskDue}
                                    onChange={(e) => setEditSubtaskDue(e.target.value)}
                                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setEditSubtaskDue('')}
                                    className="text-xs px-2 py-1 rounded border hover:bg-gray-100 dark:hover:bg-gray-800"
                                  >期限クリア</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 break-words">
                                  {s.title}
                                </div>
                                {s.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 break-words">{s.description}</div>
                                )}
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColors[s.status]}`}>{statusLabels[s.status]}</span>
                                  {s.dueDate && (
                                    <span className={`text-[10px] ${overdue ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                      📅 {format(s.dueDate, 'M/d HH:mm', { locale: ja })}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="ml-3 flex items-center gap-2 flex-shrink-0">
                            {editingSubtaskId === s.id ? (
                              <>
                                <button
                                  disabled={isSavingSubtask || !editSubtaskTitle.trim()}
                                  onClick={saveEditSubtask}
                                  className={`text-xs px-2 py-1 rounded border border-green-300 text-green-700 dark:border-green-700 dark:text-green-400 ${isSavingSubtask ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                                >{isSavingSubtask ? '保存中...' : '保存'}</button>
                                <button
                                  disabled={isSavingSubtask}
                                  onClick={cancelEditSubtask}
                                  className="text-xs px-2 py-1 rounded border hover:bg-gray-100 dark:hover:bg-gray-800"
                                >キャンセル</button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEditSubtask(s)}
                                  className="text-xs px-2 py-1 rounded border hover:bg-gray-100 dark:hover:bg-gray-800"
                                >編集</button>
                                <button
                                  disabled={updatingSubtaskId === s.id}
                                  onClick={() => updateSubtaskStatus(s.id, s.status)}
                                  className={`text-xs px-2 py-1 rounded border ${updatingSubtaskId === s.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                                  title="次のステータスへ"
                                >{updatingSubtaskId === s.id ? '更新中...' : '進捗'}</button>
                                <button
                                  disabled={deletingSubtaskId === s.id}
                                  onClick={() => deleteSubtask(s.id)}
                                  className={`text-xs px-2 py-1 rounded border border-red-300 text-red-600 dark:border-red-700 dark:text-red-400 ${deletingSubtaskId === s.id ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                  title="サブタスクを削除"
                                >{deletingSubtaskId === s.id ? '削除中...' : '削除'}</button>
                              </>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* 追加ボタン（旧UI）は削除 */}
      </div>

      {/* サブタスク詳細モーダルは廃止 */}
    </>
  )
}

export default memo(TodoItem)
