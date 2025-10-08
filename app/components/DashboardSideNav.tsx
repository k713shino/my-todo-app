'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'

type Tab = 'time' | 'tasks'

interface DashboardSideNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  onOpenSearch: () => void
  user?: {
    name?: string | null
    image?: string | null
    email?: string | null
  }
}

export default function DashboardSideNav({
  activeTab,
  onTabChange,
  onOpenSearch,
  user,
}: DashboardSideNavProps) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const userInitial = useMemo(() => {
    if (user?.name) return user.name.slice(0, 1).toUpperCase()
    if (user?.email) return user.email.slice(0, 1).toUpperCase()
    return 'U'
  }, [user?.name, user?.email])

  const currentTheme = theme === 'system' ? resolvedTheme : theme
  const isDark = (currentTheme ?? 'light') === 'dark'

  const handleToggleTheme = () => {
    if (!mounted) return
    setTheme(isDark ? 'light' : 'dark')
  }

  const triggerNewTodo = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('todo:new'))
    }
  }

type NavItem = {
  id: string
  label: string
  icon: string
  onClick?: () => void
  href?: string
}

const desktopNav: NavItem[] = [
  { id: 'tasks', label: 'ホーム', icon: '🏠', onClick: () => onTabChange('tasks') },
  { id: 'time', label: '計測ダッシュボード', icon: '⏱', onClick: () => onTabChange('time') },
  { id: 'search', label: '検索', icon: '🔍', onClick: () => onOpenSearch() },
  { id: 'export', label: 'データエクスポート', icon: '📤', href: '/settings#export' },
  { id: 'profile', label: 'プロフィール', icon: '👤', href: '/settings' },
]

const mobileNav: NavItem[] = [
  { id: 'tasks', label: 'タスク', icon: '🏠', onClick: () => onTabChange('tasks') },
  { id: 'time', label: '時間', icon: '⏱', onClick: () => onTabChange('time') },
  { id: 'search', label: '検索', icon: '🔍', onClick: () => onOpenSearch() },
  { id: 'settings', label: '設定', icon: '⚙️', href: '/settings' },
]

  return (
    <>
      <nav className="hidden xl:flex xl:w-64 flex-col gap-4 sticky top-6 self-start text-slate-700 transition-colors dark:text-slate-200">
        <div className="rounded-3xl bg-white/95 border border-slate-200 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur px-6 py-6 space-y-6 transition-colors dark:bg-slate-900/70 dark:border-slate-700/80 dark:shadow-slate-950/40">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-slate-900 font-semibold text-lg hover:text-blue-600 transition-colors dark:text-white dark:hover:text-blue-200">
            <Image src="/icons/favicon.svg" alt="My Todo" width={28} height={28} className="h-7 w-7" />
            <span>My Todo</span>
          </Link>

          <ul className="space-y-2 text-sm font-medium text-slate-600 dark:text-inherit">
            {desktopNav.map(item => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors dark:text-inherit dark:hover:bg-slate-800/70"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-full transition-colors ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200/50 dark:shadow-blue-900/40'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-inherit dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => {
              triggerNewTodo()
              onTabChange('tasks')
            }}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-500 hover:to-indigo-600 text-white font-semibold py-3 rounded-full transition-colors shadow-lg shadow-blue-200/60 dark:shadow-blue-900/40"
          >
            新規タスク
          </button>
        </div>

        <div className="rounded-3xl bg-white/95 border border-slate-200 px-6 py-4 backdrop-blur shadow-[0_12px_36px_rgba(15,23,42,0.08)] transition-colors dark:bg-slate-900/80 dark:border-slate-800 dark:shadow-slate-950/40 space-y-4">
          <div className="flex items-center gap-3">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user?.name || 'account'}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-700"
                unoptimized
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-lg font-semibold text-white">
                {userInitial}
              </div>
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900 truncate dark:text-white">{user?.name || 'ゲスト'}</div>
              <div className="text-xs text-slate-500 truncate dark:text-slate-400">{user?.email || 'ログイン情報'}</div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors dark:hover:text-red-300"
            >
              ログアウト
            </button>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span>{isDark ? '🌙' : '☀️'}</span>
              <span>{mounted ? (isDark ? 'ダークモード' : 'ライトモード') : 'テーマ'}</span>
            </div>
            <button
              type="button"
              onClick={handleToggleTheme}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
              aria-pressed={isDark}
            >
              {mounted ? (isDark ? 'ライトへ' : 'ダークへ') : '切替'}
            </button>
          </div>
        </div>
      </nav>

      <nav className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t border-slate-200 backdrop-blur shadow-[0_-18px_36px_rgba(15,23,42,0.12)] transition-colors dark:bg-slate-950/95 dark:border-slate-800 dark:shadow-none">
        <div className="flex items-center justify-around px-4 py-2">
          {mobileNav.map(item => {
            const isActive = item.id === activeTab
            const common = 'flex flex-col items-center gap-1 text-xs font-medium transition-colors'
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${common} text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              )
            }
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`${common} ${isActive ? 'text-blue-500 dark:text-blue-400' : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
              >
                <span className="text-xl">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => {
              triggerNewTodo()
              onTabChange('tasks')
            }}
            className="flex flex-col items-center gap-1 text-xs font-semibold text-blue-500 dark:text-blue-400"
          >
            <span className="text-2xl">✚</span>
            新規
          </button>
          <button
            type="button"
            onClick={handleToggleTheme}
            className="flex flex-col items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            aria-pressed={isDark}
          >
            <span className="text-xl">{isDark ? '🌙' : '☀️'}</span>
            {mounted ? (isDark ? 'ライト' : 'ダーク') : 'テーマ'}
          </button>
        </div>
      </nav>
    </>
  )
}
