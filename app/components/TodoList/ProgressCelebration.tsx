'use client'

import { useEffect, useState } from 'react'

interface ProgressCelebrationProps {
  totalTodos: number
  completedTodos: number
}

/**
 * 進捗を祝福するコンポーネント
 */
export default function ProgressCelebration({ totalTodos, completedTodos }: ProgressCelebrationProps) {
  const [showCelebration, setShowCelebration] = useState(false)
  const percentage = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0

  useEffect(() => {
    if (percentage === 100 && totalTodos > 0) {
      setShowCelebration(true)
      const timer = setTimeout(() => setShowCelebration(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [percentage, totalTodos])

  if (totalTodos === 0) return null

  // 完了率に応じたメッセージと絵文字
  const getMessage = () => {
    if (percentage === 100) {
      return { emoji: '🎉', message: '素晴らしい！全てのタスクを完了しました！', color: 'green' }
    } else if (percentage >= 75) {
      return { emoji: '💪', message: 'もう少しです！頑張りましょう！', color: 'blue' }
    } else if (percentage >= 50) {
      return { emoji: '👍', message: '順調に進んでいますね！', color: 'purple' }
    } else if (percentage >= 25) {
      return { emoji: '🌱', message: '良いスタートです！', color: 'yellow' }
    } else if (completedTodos > 0) {
      return { emoji: '✨', message: '最初の一歩を踏み出しました！', color: 'pink' }
    }
    return null
  }

  const motivationMessage = getMessage()

  return (
    <div className="space-y-3">
      {/* プログレスバー */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            進捗状況
          </span>
          <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
            {completedTodos} / {totalTodos} 完了
          </span>
        </div>

        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              percentage === 100
                ? 'bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse'
                : percentage >= 75
                ? 'bg-gradient-to-r from-blue-400 to-purple-500'
                : percentage >= 50
                ? 'bg-gradient-to-r from-purple-400 to-pink-500'
                : 'bg-gradient-to-r from-yellow-400 to-orange-500'
            }`}
            style={{ width: `${percentage}%` }}
          >
            {/* シャイン効果 */}
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>

        <div className="absolute -top-1 right-0 text-xs font-bold text-gray-600 dark:text-gray-400">
          {percentage}%
        </div>
      </div>

      {/* モチベーションメッセージ */}
      {motivationMessage && (
        <div
          className={`px-4 py-3 rounded-lg transition-all duration-300 ${
            motivationMessage.color === 'green'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : motivationMessage.color === 'blue'
              ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              : motivationMessage.color === 'purple'
              ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
              : motivationMessage.color === 'yellow'
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
              : 'bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800'
          } animate-slide-up`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-bounce">{motivationMessage.emoji}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {motivationMessage.message}
            </span>
          </div>
        </div>
      )}

      {/* 100%完了時の祝福 */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="animate-celebration">
            <div className="text-8xl animate-bounce">🎊</div>
          </div>
          <div className="absolute inset-0 animate-confetti">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
