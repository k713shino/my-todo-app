'use client'

import { useState } from 'react'
import { format, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import { Todo } from '@/types/todo'
import { safeParseDate } from '@/lib/date-utils'
import SubtaskManager from './SubtaskManager'

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
export default function TodoItem({
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
  const [showSubtaskManager, setShowSubtaskManager] = useState(false)

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

  /**
   * サブタスク管理画面を開く
   */
  const handleOpenSubtaskManager = () => {
    setShowSubtaskManager(true)
  }

  /**
   * サブタスク管理画面を閉じる
   */
  const handleCloseSubtaskManager = () => {
    setShowSubtaskManager(false)
  }

  /**
   * サブタスク変更時のコールバック
   */
  const handleSubtaskChange = () => {
    onSubtaskChange?.()
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
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/20 p-3 sm:p-4 border-l-4 transition-all duration-200 ${
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
            <button
              onClick={() => onEdit(todo)}
              disabled={isLoading}
              className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1 sm:p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
              title="編集"
            >
              <span className="text-base sm:text-lg">✏️</span>
            </button>
            {/* サブタスク詳細ボタン */}
            {todo._count?.subtasks && todo._count.subtasks > 0 && (
              <button
                onClick={handleOpenSubtaskManager}
                disabled={isLoading}
                className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 sm:p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="サブタスク詳細"
              >
                <span className="text-base sm:text-lg">📋</span>
              </button>
            )}
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
        {todo._count?.subtasks && todo._count.subtasks > 0 && (
          <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                📋 サブタスク ({todo._count.subtasks}件)
              </span>
            </div>
            
            {/* サブタスクの進捗バー */}
            {todo.subtasks && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                    style={{ 
                      width: `${(todo.subtasks.filter(s => isCompleted(s.status)).length / todo.subtasks.length) * 100}%` 
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {todo.subtasks.filter(s => isCompleted(s.status)).length} / {todo.subtasks.length} 完了
                </div>
              </div>
            )}
          </div>
        )}

        {/* サブタスクが無い場合の追加ボタン */}
        {(!todo.parentId && (!todo._count?.subtasks || todo._count.subtasks === 0)) && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleOpenSubtaskManager}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center gap-1"
            >
              <span>➕</span>
              サブタスクを追加
            </button>
          </div>
        )}
      </div>

      {/* サブタスク管理モーダル */}
      {showSubtaskManager && (
        <SubtaskManager 
          parentTodo={todo}
          onClose={handleCloseSubtaskManager}
          onSubtaskChange={handleSubtaskChange}
        />
      )}
    </>
  )
}