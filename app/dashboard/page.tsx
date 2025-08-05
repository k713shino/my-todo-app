import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import TodoList from '@/app/components/TodoList'
import Image from 'next/image'
import SignOutButton from '@/app/components/SignOutButton'
import ThemeToggle from '@/app/components/ThemeToggle'
import Link from 'next/link'
// Lambda接続テスト用のClient Componentをインポート
import LambdaConnectionTest from '../components/LambdaConnectionTest'

export default async function Dashboard() {
  const session = await getAuthSession()

  if (!isAuthenticated(session)) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* ヘッダー */}
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

      {/* メインコンテンツ */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Lambda接続テスト（管理者用） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6">
              <LambdaConnectionTest 
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
                onSuccess={(data) => {
                  console.log('✅ Lambda接続成功:', data);
                  // 必要に応じて成功時の処理を追加
                }}
                onError={(error) => {
                  console.error('❌ Lambda接続エラー:', error);
                  // 必要に応じてエラー時の処理を追加
                }}
              />
            </div>
          )}

          {/* 既存のTodoリスト */}
          <TodoList />
        </div>
      </main>
    </div>
  )
}