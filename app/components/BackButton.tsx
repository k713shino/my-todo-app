'use client'

import React from 'react'

interface BackButtonProps {
  className?: string
  label?: string
  fallbackHref?: string
}

// 戻るボタンコンポーネント
// ブラウザ履歴があれば前のページへ、なければfallbackHrefで指定されたページに遷移する
export default function BackButton({ className = '', label = 'ダッシュボードに戻る', fallbackHref = '/dashboard' }: BackButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      // ブラウザの履歴があるかチェック
      if (window.history.length > 1) {
        window.history.back()
      } else {
        // 履歴がない場合はfallbackHrefにリダイレクト
        window.location.href = fallbackHref
      }
    } catch {
      // エラー時はfallbackHrefにリダイレクト
      window.location.href = fallbackHref
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className={`tap-target inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-0 ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs sm:text-sm truncate hidden xs:inline">{label}</span>
      <span className="text-xs sm:text-sm truncate xs:hidden">戻る</span>
    </button>
  )
}

