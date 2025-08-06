import { redirect } from 'next/navigation'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import Image from 'next/image'
import Link from 'next/link'
import ThemeToggle from '@/app/components/ThemeToggle'
import SignOutButton from '@/app/components/SignOutButton'
import LambdaConnectionTest from '../components/LambdaConnectionTest'

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
            <div className="flex items-center space-x-4">
              {session.user?.image && (
                <Image
                  src={session.user.image}
                  alt="プロフィール"
                  width={64}
                  height={64}
                  className="rounded-full"
                  unoptimized
                />
              )}
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {session.user?.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {session.user?.email}
                </p>
              </div>
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

          {/* Lambda接続テスト（開発者向け） */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🔧 システム診断
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              アプリのバックエンドAPI接続状態をテストします
            </p>
            <LambdaConnectionTest 
              className="border-0 shadow-none bg-gray-50 dark:bg-gray-700"
            />
          </section>

          {/* データ管理 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📊 データ管理
            </h2>
            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  データエクスポート
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  あなたのTodoデータをJSON形式でダウンロードできます
                </p>
                <button className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm">
                  📥 データをエクスポート
                </button>
              </div>
              
              <div className="border border-red-200 dark:border-red-600 rounded-lg p-4">
                <h3 className="font-medium text-red-900 dark:text-red-400 mb-2">
                  ⚠️ データ削除
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  すべてのTodoデータを削除します（この操作は取り消せません）
                </p>
                <button className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm">
                  🗑️ すべてのデータを削除
                </button>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}