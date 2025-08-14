import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'
import SignOutButton from '@/app/components/SignOutButton'
import AccountEditor from '@/app/components/AccountEditor'
import AuthMethodDisplay from '@/app/components/AuthMethodDisplay'
import DataExportForm from '@/app/components/DataExportForm'
import AccountDeletionForm from '@/app/components/AccountDeletionForm'

export default async function SettingsPage() {
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
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="ダッシュボードに戻る"
              >
                ← 戻る
              </Link>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                ⚙️ 設定
              </h1>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* アカウント情報 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              👤 アカウント情報
            </h2>
            <AccountEditor />
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <AuthMethodDisplay />
            </div>
          </section>

          {/* テーマ設定 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🎨 テーマ設定
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-900 dark:text-white font-medium">ダークモード</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  アプリの見た目をライト/ダークテーマで切り替えます
                </p>
              </div>
              <ThemeToggle />
            </div>
          </section>

          {/* データ管理 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📊 データ管理
            </h2>
            <DataExportForm userId={session.user.id} />
          </section>

          {/* アカウント削除 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🗑️ アカウント管理
            </h2>
            <AccountDeletionForm />
          </section>

        </div>
      </main>
    </div>
  )
}