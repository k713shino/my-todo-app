import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import TodoList from '@/app/components/TodoList'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
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
              <img
                src={session.user?.image || '/default-avatar.png'}
                alt="プロフィール"
                className="w-8 h-8 rounded-full"
              />
              <a
                href="/api/auth/signout"
                className="text-sm text-red-600 hover:text-red-800 transition-colors"
              >
                ログアウト
              </a>
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
