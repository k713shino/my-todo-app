'use client'

import { ReactNode } from 'react'

interface XStyleContainerProps {
  children: ReactNode
}

/**
 * X (Twitter) スタイルのコンテナ
 * 特徴: クリーンな白背景、シャープなボーダー、控えめな影
 */
export default function XStyleContainer({ children }: XStyleContainerProps) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* ヘッダー: X風の固定ヘッダー */}
      <div className="sticky top-0 z-10 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            タスク
          </h1>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="min-h-screen bg-white dark:bg-gray-900">
        {children}
      </div>
    </div>
  )
}
