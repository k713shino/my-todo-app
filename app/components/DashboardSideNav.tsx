'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { signOut } from 'next-auth/react'

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
  const userInitial = useMemo(() => {
    if (user?.name) return user.name.slice(0, 1).toUpperCase()
    if (user?.email) return user.email.slice(0, 1).toUpperCase()
    return 'U'
  }, [user?.name, user?.email])

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
      <nav className="hidden xl:flex xl:w-64 flex-col gap-4 sticky top-6 self-start text-slate-200">
        <div className="rounded-3xl bg-slate-900/70 border border-slate-700/80 backdrop-blur px-6 py-6 space-y-6 shadow-2xl shadow-slate-900/40">
          <Link href="/dashboard" className="inline-flex items-center gap-3 text-white font-semibold text-lg hover:text-blue-200 transition-colors">
            <span className="text-2xl">🗂</span>
            <span>My Todo</span>
          </Link>

          <ul className="space-y-2 text-sm font-medium">
            {desktopNav.map(item => (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-slate-800/70 transition-colors"
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-full transition-colors ${
                      activeTab === item.id ? 'bg-blue-500 text-white shadow-lg shadow-blue-900/40' : 'hover:bg-slate-800/70 text-slate-200'
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
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full transition-colors shadow-lg shadow-blue-900/40"
          >
            ポストする
          </button>
        </div>

        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 px-6 py-4 backdrop-blur shadow-xl shadow-slate-900/50">
          <div className="flex items-center gap-3">
            {user?.image ? (
              <Image
                src={user.image}
                alt={user?.name || 'account'}
                width={44}
                height={44}
                className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-700"
                unoptimized
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-lg font-semibold">
                {userInitial}
              </div>
            )}
            <div className="flex-1">
              <div className="text-sm font-semibold text-white truncate">{user?.name || 'ゲスト'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email || 'ログイン情報'}</div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="text-xs text-slate-400 hover:text-red-300 transition-colors"
            >
              ログアウト
            </button>
          </div>
        </div>
      </nav>

      <nav className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur">
        <div className="flex items-center justify-around px-4 py-2">
          {mobileNav.map(item => {
            const isActive = item.id === activeTab
            const common = 'flex flex-col items-center gap-1 text-xs font-medium transition-colors'
            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${common} text-slate-300 hover:text-white`}
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
                className={`${common} ${isActive ? 'text-blue-400' : 'text-slate-300 hover:text-white'}`}
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
            className="flex flex-col items-center gap-1 text-xs font-semibold text-blue-400"
          >
            <span className="text-2xl">✚</span>
            新規
          </button>
        </div>
      </nav>
    </>
  )
}
