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

  // 先読み：ダッシュボードを事前プリフェッチして遷移体感を短縮
  useEffect(() => {
    try { router.prefetch('/dashboard') } catch {}
  }, [router])

  // ローディング中
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    )
  }

  // ログイン済みの場合はダッシュボードへ
  if (session) {
    return null // useEffectでリダイレクトされる
  }

  // 未ログインユーザー用のランディングページ
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800 transition-all duration-500">
      {/* ヘッダー */}
      <header className="bg-white/10 dark:bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-2xl font-bold text-white dark:text-gray-100">
              <img src="/icons/todo-icon-circle.svg" alt="" className="inline-block w-6 h-6 mr-2 align-[-0.2em]" />
              Todo管理システム
            </h1>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <ThemeToggle />
              <Link
                href="/auth/signin"
                className="text-white dark:text-gray-300 hover:text-gray-200 dark:hover:text-white transition-colors text-sm sm:text-base"
              >
                ログイン
              </Link>
              <Link
                href="/auth/register"
                className="bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 px-3 py-1.5 sm:px-4 sm:py-2 rounded-md font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm sm:text-base"
              >
                新規登録
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white dark:text-gray-100 mb-4 sm:mb-6 leading-tight">
            効率的なタスク管理で
            <br />
            <span className="text-yellow-300 dark:text-yellow-400">生産性向上</span>
          </h2>
          <p className="text-base sm:text-xl text-white/90 dark:text-gray-300 mb-6 sm:mb-8 max-w-2xl mx-auto leading-relaxed">
            優先度設定、期限管理、進捗追跡などの機能で、
            あなたのタスクを効率的に管理しましょう。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-block bg-yellow-400 dark:bg-yellow-500 text-gray-900 dark:text-gray-800 px-6 py-3 sm:px-8 rounded-lg font-semibold hover:bg-yellow-300 dark:hover:bg-yellow-400 transition-colors text-center"
            >
              今すぐ始める
            </Link>
            <Link
              href="/auth/signin"
              className="w-full sm:w-auto inline-block bg-white/20 dark:bg-white/10 text-white dark:text-gray-200 px-6 py-3 sm:px-8 rounded-lg font-semibold hover:bg-white/30 dark:hover:bg-white/20 transition-colors backdrop-blur-sm text-center"
            >
              ログイン
            </Link>
          </div>
        </div>

        {/* 機能紹介 */}
        <div className="mt-12 sm:mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-lg border border-white/20 dark:border-white/10">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🔐</div>
            <h3 className="text-lg sm:text-xl font-semibold text-white dark:text-gray-100 mb-2">
              セキュアな認証
            </h3>
            <p className="text-sm sm:text-base text-white/80 dark:text-gray-300">
              GitHub、Google、またはメールアドレスで安全にログイン
            </p>
          </div>
          
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-lg border border-white/20 dark:border-white/10">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📊</div>
            <h3 className="text-lg sm:text-xl font-semibold text-white dark:text-gray-100 mb-2">
              優先度管理
            </h3>
            <p className="text-sm sm:text-base text-white/80 dark:text-gray-300">
              4段階の優先度でタスクを効率的に管理
            </p>
          </div>
          
          <div className="bg-white/10 dark:bg-white/5 backdrop-blur-sm p-4 sm:p-6 rounded-lg border border-white/20 dark:border-white/10">
            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📅</div>
            <h3 className="text-lg sm:text-xl font-semibold text-white dark:text-gray-100 mb-2">
              期限管理
            </h3>
            <p className="text-sm sm:text-base text-white/80 dark:text-gray-300">
              期限設定とアラートで重要なタスクを見逃さない
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
