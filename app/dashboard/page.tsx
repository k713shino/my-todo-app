import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import TodoList from '@/app/components/TodoList'
import Image from 'next/image'
import SignOutButton from '@/app/components/SignOutButton'
import ThemeToggle from '@/app/components/ThemeToggle'
import Link from 'next/link'

export default async function Dashboard() {
  const session = await getAuthSession()

  if (!isAuthenticated(session)) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* ヘッダー */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                ✨ {session.user?.name}専用Todoアプリ
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                こんにちは、{session.user?.name}さん 👋
              </span>
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt="プロフィール"
                  width={32}
                  height={32}
                  className="rounded-full"
                  unoptimized
                />
              )}
              {/* テーマ切り替え */}
              <ThemeToggle />
              {/* 設定リンク追加 */}
              <Link
                href="/settings"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                title="アカウント設定"
              >
                ⚙️ 設定
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="py-8">
        <TodoList />
      </main>
    </div>
  )
}