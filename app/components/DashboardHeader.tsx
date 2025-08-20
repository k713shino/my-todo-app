'use client'

import { useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import SignOutButton from './SignOutButton'
import ThemeToggle from './ThemeToggle'

export default function DashboardHeader() {
  const { data: session } = useSession()

  if (!session?.user) {
    return null
  }

  return (
    <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
              ✨ <span className="hidden sm:inline">{session.user?.name}専用</span>Todo<span className="hidden xs:inline">アプリ</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4 ml-2">
            <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden md:block">
              こんにちは、{session.user?.name}さん 👋
            </span>
            {session.user?.image && (
              <Image
                src={session.user.image}
                alt="プロフィール"
                width={28}
                height={28}
                className="rounded-full sm:w-8 sm:h-8"
                unoptimized
              />
            )}
            {/* テーマ切り替え */}
            <ThemeToggle />
            {/* 設定リンク追加 */}
            <Link
              href="/settings"
              className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors p-1"
              title="アカウント設定"
            >
              ⚙️
            </Link>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  )
}