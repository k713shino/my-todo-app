'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import ThemeToggle from './components/ThemeToggle'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 認証済みユーザーをダッシュボードにリダイレクト
  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // ログイン済みの場合はダッシュボードへ
  if (session) {
    return null // useEffectでリダイレクトされる
  }

  // 未ログインユーザー用のランディングページ
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* ヘッダー */}
      <header className="bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-white dark:text-gray-200">
              ✨ Todo管理システム
            </h1>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link
                href="/auth/signin"
                className="text-white dark:text-gray-300 hover:text-gray-200 dark:hover:text-white transition-colors"
              >
                ログイン
              </Link>
              <Link
                href="/auth/register"
                className="bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-md font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-5xl font-extrabold text-white mb-6">
            効率的なタスク管理で
            <br />
            <span className="text-yellow-300">生産性向上</span>
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            優先度設定、期限管理、進捗追跡などの機能で、
            あなたのタスクを効率的に管理しましょう。
          </p>
          
          <div className="space-x-4">
            <Link
              href="/auth/register"
              className="inline-block bg-yellow-400 text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-yellow-300 transition-colors"
            >
              今すぐ始める
            </Link>
            <Link
              href="/auth/signin"
              className="inline-block bg-white/20 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors backdrop-blur-sm"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* 機能紹介 */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
            <div className="text-4xl mb-4">🔐</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              セキュアな認証
            </h3>
            <p className="text-white/80">
              GitHub、Google、またはメールアドレスで安全にログイン
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              優先度管理
            </h3>
            <p className="text-white/80">
              4段階の優先度でタスクを効率的に管理
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-lg">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              期限管理
            </h3>
            <p className="text-white/80">
              期限設定とアラートで重要なタスクを見逃さない
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}