'use client'

import { useState } from 'react'
import { format, isAfter } from 'date-fns'
import { ja } from 'date-fns/locale'
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
  onUpdate: (id: string, data: { completed?: boolean }) => void
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => void
  isLoading?: boolean
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
  isLoading = false 
}: TodoItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  /**
   * 期限切れ判定
   * - 期限が設定されている
   * - 未完了のタスク
   * - 現在時刻が期限を超えている
   */
  const isOverdue = todo.dueDate && !todo.completed &&
    isAfter(new Date(), new Date(todo.dueDate))

  /**
   * 完了状態切り替えハンドラー
   * - ローディング状態を制御
   * - 完了状態を反転して更新
   */
  const handleToggleComplete = async () => {
    setIsUpdating(true)
    try {
      await onUpdate(todo.id, { completed: !todo.completed })
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

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-900/20 p-4 border-l-4 transition-all duration-200 ${
      todo.completed 
        ? 'border-green-400 dark:border-green-500 opacity-75' 
        : isOverdue 
        ? 'border-red-400 dark:border-red-500' 
        : 'border-purple-400 dark:border-purple-500'
    } ${isUpdating ? 'opacity-50' : ''}`}>
      
      {/* ヘッダー */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-3 flex-1">
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={handleToggleComplete}
            disabled={isLoading || isUpdating}
            className="w-5 h-5 text-purple-600 dark:text-purple-400 rounded focus:ring-purple-500 dark:focus:ring-purple-400 dark:bg-gray-700 dark:border-gray-600"
          />
          <h3 className={`text-lg font-medium ${
            todo.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {priorityIcons[todo.priority]} {todo.title}
          </h3>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => onEdit(todo)}
            disabled={isLoading}
            className="text-gray-400 dark:text-gray-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            title="編集"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={isLoading}
            className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="削除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* 説明 */}
      {todo.description && (
        <p className={`text-sm mb-3 ${
          todo.completed ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'
        }`}>
          {todo.description}
        </p>
      )}

      {/* メタ情報 */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {/* 優先度 */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[todo.priority]}`}>
          {priorityLabels[todo.priority]}
        </span>

        {/* 期限 */}
        {todo.dueDate && (
          <span className={`text-xs ${
            isOverdue && !todo.completed 
              ? 'text-red-600 dark:text-red-400 font-medium' 
              : todo.completed 
              ? 'text-gray-400 dark:text-gray-500' 
              : 'text-gray-600 dark:text-gray-300'
          }`}>
            📅 {format(new Date(todo.dueDate), 'yyyy年M月d日 HH:mm', { locale: ja })}
            {isOverdue && !todo.completed && ' (期限切れ)'}
          </span>
        )}

        {/* 作成日 */}
        <span className="text-xs text-gray-400 dark:text-gray-500">
          作成: {format(new Date(todo.createdAt), 'M月d日 HH:mm', { locale: ja })}
        </span>
      </div>
    </div>
  )
}