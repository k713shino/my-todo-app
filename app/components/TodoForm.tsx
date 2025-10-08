'use client'

import { useState, useEffect } from 'react'
import { Priority, Status } from '@prisma/client'
import { format } from 'date-fns'
import Image from 'next/image'

/**
 * Todoフォームコンポーネントのプロパティ定義
 *
 * @param onSubmit フォーム送信時のコールバック関数
 * @param onCancel 編集モード時のキャンセルボタン用コールバック関数（任意）
 * @param initialData 編集時の初期データ（任意）
 * @param isLoading 送信中の状態を示すフラグ
 */
interface TodoFormProps {
  onSubmit: (data: {
    title: string
    description?: string
    priority: Priority
    status?: Status
    dueDate?: Date
    category?: string
    tags?: string[]
  }) => void
  onCancel?: () => void
  initialData?: {
    title?: string
    description?: string | null | undefined 
    priority?: Priority
    status?: Status
    dueDate?: Date | null
    category?: string
    tags?: string[]
  }
  isLoading?: boolean
}

/**
 * 優先度の表示ラベル
 * データベース上の英語表記を日本語表示に変換
 */
const _priorityLabels = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
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
 * Todoの作成・編集フォームコンポーネント
 *
 * 機能:
 * - 新規Todo作成
 * - 既存Todoの編集
 * - バリデーション（タイトル必須）
 * - ローディング状態の制御
 * - フォームリセット（新規作成時のみ）
 */
export default function TodoForm({
  onSubmit, 
  onCancel, 
  initialData, 
  isLoading = false 
}: TodoFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [status, setStatus] = useState<Status>('TODO')
  const [dueDate, setDueDate] = useState('')
  // ユーザーが編集中（ローカルで値を変更済み）かの判定
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    // 初期データが変わった時のみフォームを初期化する
    // ただし、ユーザーが編集中（dirty）の場合は上書きしない
    if (dirty) return
    if (initialData) {
      setTitle(initialData.title || '')
      setDescription(initialData.description || '')
      setPriority(initialData.priority || 'MEDIUM')
      setStatus(initialData.status || 'TODO')
      setDueDate(initialData.dueDate ? format(initialData.dueDate, 'yyyy-MM-dd\'T\'HH:mm') : '')
      setCategory(initialData.category || '')
      setTags(initialData.tags?.join(', ') || '')
    } else {
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setStatus('TODO')
      setDueDate('')
      setCategory('')
      setTags('')
    }
  }, [initialData, dirty])

  /**
   * フォーム送信処理
   * @param e フォームイベント
   *
   * - タイトルの入力チェック
   * - 入力値のトリミング
   * - 新規作成時はフォームをリセット
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!title.trim()) {
      alert('タイトルを入力してください')
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status, // 新規作成時・編集時ともにstatusを送信
      dueDate: dueDate ? new Date(dueDate) : undefined,
      category: category.trim() || undefined,
      tags: tags.trim() ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : undefined,
    })

    // 送信後は親側でフォームが閉じられるため、ここではdirtyを維持して一時的な巻き戻りを防ぐ

    // リセット（新規作成時のみ）
    if (!initialData) {
      setTitle('')
      setDescription('')
      setPriority('MEDIUM')
      setStatus('TODO')
      setDueDate('')
      setCategory('')
      setTags('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-md space-y-3 sm:space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
        {initialData ? '✏️ Todoを編集' : (
          <>
            <Image src="/icons/todo-icon-circle.svg" alt="" width={20} height={20} className="inline-block w-5 h-5 mr-2 align-[-0.2em]" />
            新しいTodoを作成
          </>
        )}
      </h3>

      {/* タイトル */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          タイトル *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="何をしますか？"
          required
          disabled={isLoading}
        />
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          説明
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); setDirty(true) }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="詳細を入力してください（任意）"
          rows={3}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* 優先度 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            優先度
          </label>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value as Priority); setDirty(true) }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          >
            {Object.entries(_priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            タスクの重要度を設定 (デフォルト: 中)
          </p>
        </div>

        {/* ステータス */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ステータス
          </label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value as Status); setDirty(true) }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {initialData 
              ? 'タスクのステータスを変更できます' 
              : 'タスクの初期ステータスを設定 (デフォルト: 未着手)'}
          </p>
        </div>

        {/* 期限 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            期限
          </label>
          <input
            type="datetime-local"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); setDirty(true) }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            タスクの完了予定日時を設定 (任意)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* カテゴリ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            カテゴリ
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setDirty(true) }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="例: 学校, 家, 趣味"
            disabled={isLoading}
          />
        </div>

        {/* タグ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            タグ
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => { setTags(e.target.value); setDirty(true) }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="カンマで区切って入力（例: 緊急, 楽しい）"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ボタン */}
      <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors"
            disabled={isLoading}
            onMouseDown={() => setDirty(false)}
          >
            キャンセル
          </button>
        )}
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading || !title.trim()}
        >
          {isLoading ? '保存中...' : (initialData ? '更新' : '作成')}
        </button>
      </div>
    </form>
  )
}
