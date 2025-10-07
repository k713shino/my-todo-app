'use client'

import { useState, useEffect } from 'react'

interface EmptyStateProps {
  viewType: 'all' | 'status' | 'calendar' | 'kanban'
  hasAnyTodos: boolean
  isFiltered: boolean
}

/**
 * ユーザーに寄り添った空状態コンポーネント
 */
export default function EmptyState({ viewType, hasAnyTodos, isFiltered }: EmptyStateProps) {
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setShowTip(true), 500)
    return () => clearTimeout(timer)
  }, [])

  // フィルター適用中で結果がない場合
  if (isFiltered) {
    return (
      <div className="text-center py-16 px-4 animate-fade-in">
        <div className="text-6xl mb-4 animate-bounce">🔍</div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          該当するタスクが見つかりませんでした
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          検索条件を変更してもう一度お試しください
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
          💡 ヒント：フィルターをクリアすると全てのタスクが表示されます
        </div>
      </div>
    )
  }

  // Todoが1つもない場合（初回訪問）
  if (!hasAnyTodos) {
    return (
      <div className="text-center py-16 px-4 animate-fade-in">
        <div className="text-7xl mb-6 animate-pulse">✨</div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-3">
          ようこそ！
        </h3>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
          最初のタスクを作成して、生産性の旅を始めましょう 🚀
        </p>

        {showTip && (
          <div className="space-y-4 max-w-lg mx-auto animate-slide-up">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 shadow-sm">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span className="text-xl">💡</span>
                使い方のヒント
              </h4>
              <ul className="text-left space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>下のフォームからタスクを追加できます</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>優先度や期限を設定して整理しましょう</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">•</span>
                  <span>複数のビュー（リスト/ステータス/カレンダー）を活用できます</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ビュー別の空状態メッセージ
  const viewMessages = {
    all: {
      icon: '📝',
      title: 'タスクがありません',
      message: '新しいタスクを追加して始めましょう！',
      tip: '下のフォームから簡単に追加できます'
    },
    status: {
      icon: '📊',
      title: 'ステータス別タスクがありません',
      message: 'タスクを追加してワークフローを管理しましょう',
      tip: 'ステータス別に進捗を可視化できます'
    },
    calendar: {
      icon: '📅',
      title: '期限が設定されたタスクがありません',
      message: 'タスクに期限を設定してカレンダーで確認しましょう',
      tip: '期限を設定すると、このカレンダーに表示されます'
    },
    kanban: {
      icon: '🗂️',
      title: 'かんばんボードが空です',
      message: 'タスクをドラッグ&ドロップで管理しましょう',
      tip: 'タスクをステータス間で移動できます'
    }
  }

  const message = viewMessages[viewType]

  return (
    <div className="text-center py-16 px-4 animate-fade-in">
      <div className="text-6xl mb-4">{message.icon}</div>
      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {message.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        {message.message}
      </p>
      {showTip && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-sm text-purple-700 dark:text-purple-300 animate-slide-up">
          ✨ {message.tip}
        </div>
      )}
    </div>
  )
}
