import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import TodoList from '@/app/components/TodoList'
import Image from 'next/image'
import SignOutButton from '@/app/components/SignOutButton'
import Link from 'next/link'

export default async function Dashboard() {
  const session = await getAuthSession()

  if (!isAuthenticated(session)) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                ✨ {session.user?.name}専用Todoアプリ
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                こんにちは、{session.user?.name}さん 👋
              </span>
              {/* デバッグ出力 */}
              <div className="text-xs text-gray-400">
                Image URL: {session.user?.image}
              </div>
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
              {/* 設定リンク追加 */}
              <Link
                href="/settings"
                className="text-sm text-gray-600 hover:text-purple-600 transition-colors"
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