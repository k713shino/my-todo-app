'use client'

import { useState, useCallback, memo, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import { Todo } from '@/types/todo'

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
 * 視覚的に優先度を表現
 */
const priorityIcons = {
  LOW: '💎',
  MEDIUM: '✨',
  HIGH: '⚡',
  URGENT: '🔥',
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
  onSelect
}: TodoItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isTracking, setIsTracking] = useState<boolean>(false)

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
  const _handleStatusChange = async () => {
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
      // startedAtを保存（経過タイマーのローカルフォールバック用）
      try {
        const data = await res.clone().json().catch(() => null)
        if (data && data.startedAt) {
          localStorage.setItem('time:startedAt', String(data.startedAt))
        }
      } catch {}
      try {
        localStorage.setItem('time:runningTodoId', String(todo.id))
        if (todo?.title) localStorage.setItem('time:runningTitle', String(todo.title))
      } catch {}
      setIsTracking(true)
      toast.success('⏱️ 計測を開始しました')
      try { 
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('time:runningChanged'))
          window.dispatchEvent(new CustomEvent('todo:changed'))
        }
      } catch {}
    } catch {
      toast.error('計測開始に失敗しました')
    }
  }, [todo.id, todo.title])

  const stopTracking = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/stop', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try {
        localStorage.removeItem('time:runningTodoId')
        localStorage.removeItem('time:startedAt')
        localStorage.removeItem('time:runningTitle')
      } catch {}
      setIsTracking(false)
      toast('⏹️ 計測を停止しました')
      try {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('time:runningChanged'))
          window.dispatchEvent(new CustomEvent('todo:changed'))
        }
      } catch {}
    } catch {
      toast.error('計測停止に失敗しました')
    }
  }, [])

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
                    {todo.title}
                  </h3>
                </div>
                
                {/* ステータス操作タブ */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex flex-wrap gap-1 sm:gap-1.5" role="tablist" aria-label="進捗ステータス">
                    {(Object.entries(statusLabels) as [Status, string][]).map(([value, label]) => {
                      const isActive = todo.status === value
                      return (
                        <button
                          key={value}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => {
                            if (!isActive) onUpdate(todo.id, { status: value })
                          }}
                          disabled={isLoading || isUpdating}
                          className={`px-2 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                            isActive
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                          } ${isLoading || isUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
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
          {/* 優先度 - 視認性向上 */}
          <span className={`px-2.5 py-1 rounded-full text-xs sm:text-sm font-semibold inline-flex items-center gap-1 ${priorityColors[todo.priority]} shadow-sm`}>
            <span>{priorityIcons[todo.priority]}</span>
            <span>{priorityLabels[todo.priority]}</span>
          </span>

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

        {/* 追加ボタン（旧UI）は削除 */}
      </div>

    </>
  )
}

export default memo(TodoItem)
