'use client'

import { useEffect } from 'react'

interface ImportResultModalProps {
  isOpen: boolean
  onClose: () => void
  result: {
    type: 'success' | 'info' | 'error'
    title: string
    message: string
    importedCount?: number
    skippedCount?: number
    totalCount?: number
  } | null
}

export default function ImportResultModal({ isOpen, onClose, result }: ImportResultModalProps) {
  // Escキーで閉じる
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // ボディのスクロールを無効化
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen || !result) return null

  const getIcon = () => {
    switch (result.type) {
      case 'success':
        return '✅'
      case 'info':
        return 'ℹ️'
      case 'error':
        return '❌'
      default:
        return '📋'
    }
  }

  const getBgColor = () => {
    switch (result.type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/20'
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/20'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20'
      default:
        return 'bg-gray-50 dark:bg-gray-900/20'
    }
  }

  const getBorderColor = () => {
    switch (result.type) {
      case 'success':
        return 'border-green-200 dark:border-green-700'
      case 'info':
        return 'border-blue-200 dark:border-blue-700'
      case 'error':
        return 'border-red-200 dark:border-red-700'
      default:
        return 'border-gray-200 dark:border-gray-700'
    }
  }

  const getTextColor = () => {
    switch (result.type) {
      case 'success':
        return 'text-green-800 dark:text-green-300'
      case 'info':
        return 'text-blue-800 dark:text-blue-300'
      case 'error':
        return 'text-red-800 dark:text-red-300'
      default:
        return 'text-gray-800 dark:text-gray-300'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* オーバーレイ */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* モーダルコンテンツ */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 duration-300">
        <div className={`
          bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 
          ${getBorderColor()} ${getBgColor()}
          transform transition-all duration-300
        `}>
          {/* ヘッダー */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-3xl">{getIcon()}</div>
                <h2 className={`text-xl font-bold ${getTextColor()}`}>
                  {result.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
          </div>

          {/* ボディ */}
          <div className="px-6 py-5">
            <p className={`text-base mb-4 ${getTextColor()}`}>
              {result.message}
            </p>

            {/* 詳細情報（成功・情報の場合） */}
            {(result.type === 'success' || result.type === 'info') && (
              <div className="space-y-2">
                {result.importedCount !== undefined && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                    <span className="font-medium text-gray-700 dark:text-gray-300">インポート成功</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {result.importedCount}件
                    </span>
                  </div>
                )}
                {result.skippedCount !== undefined && result.skippedCount > 0 && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                    <span className="font-medium text-gray-700 dark:text-gray-300">重複スキップ</span>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">
                      {result.skippedCount}件
                    </span>
                  </div>
                )}
                {result.totalCount !== undefined && (
                  <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                    <span className="font-medium text-gray-700 dark:text-gray-300">総ファイル数</span>
                    <span className="font-bold text-gray-600 dark:text-gray-400">
                      {result.totalCount}件
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className={`
                  px-6 py-2 rounded-lg font-medium transition-all duration-200
                  ${result.type === 'success' 
                    ? 'bg-green-600 hover:bg-green-700 text-white' 
                    : result.type === 'info'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                  }
                  hover:shadow-lg transform hover:scale-105
                `}
              >
                確認
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}