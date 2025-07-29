'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

interface ThemeOption {
  value: string
  label: string
  icon: string
}

const themeOptions: ThemeOption[] = [
  { value: 'light', label: 'ライト', icon: '☀️' },
  { value: 'dark', label: 'ダーク', icon: '🌙' },
  { value: 'system', label: 'システム', icon: '💻' },
]

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme, resolvedTheme, systemTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      // テーマ変更時にHTMLクラスを適切に設定
      const html = document.documentElement
      
      // 明示的にlight/darkクラスを管理
      html.classList.remove('light')
      if (theme === 'light') {
        html.classList.add('light')
      } else if (theme === 'dark') {
        // darkクラスはnext-themesが管理するので追加しない
        // システムテーマでもない場合のみlightクラスを削除
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Theme Debug:', {
          theme,
          resolvedTheme,
          systemTheme,
          htmlClass: html.className
        })
      }
    }
  }, [theme, resolvedTheme, systemTheme, mounted])

  if (!mounted) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse">
        <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
        <div className="w-16 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
      </div>
    )
  }

  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm dark:shadow-gray-900/20"
        aria-label="テーマを選択"
      >
        {themeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.icon} {option.label}
          </option>
        ))}
      </select>
      
      {/* カスタム矢印 */}
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}