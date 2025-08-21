'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AccountDeletionResultModalProps {
  isOpen: boolean
  onClose: () => void
  result: {
    type: 'success' | 'error'
    title: string
    message: string
    details?: {
      todoCount?: number
      authMethod?: string
      memberSince?: string
      deletedAt?: string
    }
    errorCode?: string
  } | null
}

export default function AccountDeletionResultModal({ 
  isOpen, 
  onClose, 
  result 
}: AccountDeletionResultModalProps) {
  const router = useRouter()

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
    return result.type === 'success' ? '✅' : '❌'
  }

  const getBgColor = () => {
    return result.type === 'success' 
      ? 'bg-green-50 dark:bg-green-900/20' 
      : 'bg-red-50 dark:bg-red-900/20'
  }

  const getBorderColor = () => {
    return result.type === 'success' 
      ? 'border-green-200 dark:border-green-700' 
      : 'border-red-200 dark:border-red-700'
  }

  const getTextColor = () => {
    return result.type === 'success' 
      ? 'text-green-800 dark:text-green-300' 
      : 'text-red-800 dark:text-red-300'
  }

  const handleConfirm = () => {
    onClose()
    if (result.type === 'success') {
      // 成功時はホームページに戻す
      router.push('/')
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
      <div className="relative z-10 w-full max-w-lg mx-4 animate-in zoom-in-95 duration-300">
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

            {/* 成功時の詳細情報 */}
            {result.type === 'success' && result.details && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  📊 削除されたデータ
                </h4>
                <div className="space-y-2">
                  {result.details.todoCount !== undefined && (
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                      <span className="font-medium text-gray-700 dark:text-gray-300">削除されたTodo</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {result.details.todoCount}件
                      </span>
                    </div>
                  )}
                  {result.details.authMethod && (
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                      <span className="font-medium text-gray-700 dark:text-gray-300">認証方法</span>
                      <span className="font-bold text-gray-600 dark:text-gray-400">
                        {result.details.authMethod === 'credentials' ? 'パスワード認証' : 'OAuth認証'}
                      </span>
                    </div>
                  )}
                  {result.details.memberSince && (
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                      <span className="font-medium text-gray-700 dark:text-gray-300">利用開始日</span>
                      <span className="font-bold text-gray-600 dark:text-gray-400">
                        {new Date(result.details.memberSince).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  )}
                  {result.details.deletedAt && (
                    <div className="flex justify-between items-center py-2 px-3 bg-white dark:bg-gray-700 rounded-lg border">
                      <span className="font-medium text-gray-700 dark:text-gray-300">削除完了時刻</span>
                      <span className="font-bold text-gray-600 dark:text-gray-400">
                        {new Date(result.details.deletedAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>GDPR準拠</strong>: すべてのデータが完全に削除され、復旧することはできません。
                  </p>
                </div>
              </div>
            )}

            {/* エラー時の詳細情報 */}
            {result.type === 'error' && result.errorCode && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>エラーコード:</strong> {result.errorCode}
                </p>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl">
            <div className="flex justify-end space-x-3">
              {result.type === 'success' ? (
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                >
                  ホームページに戻る
                </button>
              ) : (
                <>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-all duration-200"
                  >
                    閉じる
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105"
                  >
                    再試行
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}