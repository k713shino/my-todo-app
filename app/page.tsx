'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState } from 'react'

export default function Home() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('github', { callbackUrl: '/dashboard' })
    } catch (error) {
      console.error('ログインエラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('ログアウトエラー:', error)
    }
  }

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // ログイン済み
  if (session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-2xl font-bold text-gray-900">
                Todo管理システム
              </h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {session.user?.name || session.user?.email}さん
                </span>
                {session.user?.image && (
                  <img
                    src={session.user.image}
                    alt="プロフィール"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <button
                  onClick={handleSignOut}
                  className="text-sm text-red-600 hover:text-red-800 transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>
        
        <main className="py-8">
          <div className="max-w-4xl mx-auto p-6">
            <div className="bg-white p-8 rounded-lg shadow-md text-center">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                ダッシュボード
              </h2>
              <p className="text-gray-600 mb-4">
                ログイン成功！第5章でTodoコンポーネントを実装すると、ここにTodoリストが表示されます。
              </p>
              <div className="bg-green-100 p-4 rounded-lg">
                <p className="text-green-800">
                  🎉 認証システムが正常に動作しています！
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 未ログイン
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Todo管理システム
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            効率的なタスク管理で生産性向上
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              🐙
            </span>
            {isLoading ? '認証中...' : 'GitHubでログイン'}
          </button>
          
          <div className="text-center">
            <p className="text-sm text-gray-500">
              GitHubアカウントでログインしてください
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}