import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import TodoList from '@/app/components/TodoList'
import DashboardHeader from '@/app/components/DashboardHeader'
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
      <DashboardHeader />

      {/* メインコンテンツ */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-7xl mx-auto">
          {/* Lambda接続テスト（管理者用） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6">
              <LambdaConnectionTest 
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700"
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