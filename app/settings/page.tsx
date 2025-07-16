import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import PasswordChangeForm from '@/app/components/PasswordChangeForm'
import AccountDeletionForm from '@/app/components/AccountDeletionForm'
import ProfileSettingsForm from '@/app/components/ProfileSettingsForm'
import DataExportForm from '@/app/components/DataExportForm'
import OAuthManagementForm from '@/app/components/OAuthManagementForm'

export default async function SettingsPage() {
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
            <div className="flex items-center space-x-4">
              <a href="/dashboard" className="text-purple-600 hover:text-purple-800">
                ← ダッシュボードに戻る
              </a>
              <h1 className="text-2xl font-bold text-gray-900">⚙️ アカウント設定</h1>
            </div>
            <div className="text-sm text-gray-600">
              {session.user?.name || session.user?.email}
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          
          {/* プロフィール設定 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">👤 プロフィール</h2>
            <ProfileSettingsForm user={session.user} />
          </section>

          {/* OAuth連携管理 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔗 連携サービス</h2>
            <OAuthManagementForm />
          </section>

          {/* セキュリティ設定 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔒 セキュリティ</h2>
            <PasswordChangeForm />
          </section>

          {/* データ管理 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 データ管理</h2>
            <DataExportForm userId={session.user.id} />
          </section>

          {/* 危険なアクション */}
          <section>
            <h2 className="text-xl font-semibold text-red-900 mb-4">⚠️ 危険なアクション</h2>
            <AccountDeletionForm />
          </section>

        </div>
      </main>
    </div>
  )
}