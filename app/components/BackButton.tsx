'use client'

import React from 'react'

interface BackButtonProps {
  className?: string
  label?: string
  fallbackHref?: string
}

export default function BackButton({ className = '', label = 'ダッシュボードに戻る', fallbackHref = '/dashboard' }: BackButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        window.location.href = fallbackHref
      }
    } catch {
      window.location.href = fallbackHref
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      className={`tap-target inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${className}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-sm">{label}</span>
    </button>
  )
}

