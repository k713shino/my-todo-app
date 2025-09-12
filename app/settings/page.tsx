import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'
import SignOutButton from '@/app/components/SignOutButton'
import AccountEditor from '@/app/components/AccountEditor'
import AuthMethodDisplay from '@/app/components/AuthMethodDisplay'
import PasswordChangeForm from '@/app/components/PasswordChangeForm'
import DataManagementForm from '@/app/components/DataManagementForm'
import NotificationSettings from '@/app/components/NotificationSettings'
import AccountDeletionForm from '@/app/components/AccountDeletionForm'
import BackButton from '@/app/components/BackButton'

export default async function SettingsPage() {
  const session = await getAuthSession()

  if (!isAuthenticated(session)) {
    redirect('/auth/signin')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* ヘッダー - モバイル最適化 */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 fixed top-0 left-0 right-0 z-50 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <BackButton className="flex-shrink-0" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                <span className="hidden xs:inline">⚙️ </span>設定
              </h1>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ（固定ヘッダー分の余白を確保） */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pt-24 sm:pt-28 md:pt-32 lg:pt-36">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 lg:space-y-8">
          
          {/* アカウント情報 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
              <span className="text-xl sm:text-2xl mr-2">👤</span>
              <span>アカウント情報</span>
            </h2>
            <AccountEditor />
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <AuthMethodDisplay />
            </div>
          </section>

          {/* テーマ設定 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
              <span className="text-xl sm:text-2xl mr-2">🎨</span>
              <span>テーマ設定</span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="min-w-0 flex-1">
                <p className="text-gray-900 dark:text-white font-medium">ダークモード</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  アプリの見た目をライト/ダークテーマで切り替えます
                </p>
              </div>
              <div className="flex-shrink-0 self-start sm:self-center">
                <ThemeToggle />
              </div>
            </div>
          </section>

          {/* パスワード変更 */}
          <PasswordChangeForm />

          {/* データ管理 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
              <span className="text-xl sm:text-2xl mr-2">📊</span>
              <span>データ管理</span>
            </h2>
            <DataManagementForm userId={session.user.id} />
          </section>

          {/* 通知設定 */}
          <NotificationSettings />

          {/* アカウント削除 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
              <span className="text-xl sm:text-2xl mr-2">🗑️</span>
              <span>アカウント管理</span>
            </h2>
            <AccountDeletionForm />
          </section>

        </div>
      </main>
    </div>
  )
}
