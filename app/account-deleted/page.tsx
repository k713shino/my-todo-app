'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AccountDeletedPage() {
  const router = useRouter()

  useEffect(() => {
    // 30秒後に自動リダイレクト
    const timer = setTimeout(() => {
      router.push('/')
    }, 30000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-6xl mb-4">👋</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          アカウントが削除されました
        </h1>
        <p className="text-gray-600 mb-6">
          あなたのアカウントとすべての関連データが正常に削除されました。
          今までのご利用ありがとうございました。
        </p>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            削除されたデータ：
          </p>
          <ul className="text-sm text-gray-600 text-left space-y-1">
            <li>• アカウント情報</li>
            <li>• すべてのTodoデータ</li>
            <li>• ログイン履歴</li>
            <li>• プロフィール設定</li>
          </ul>
        </div>

        <div className="mt-8 pt-6 border-t">
          <a
            href="/"
            className="inline-block px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            ホームページに戻る
          </a>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          このページは30秒後に自動的にホームページにリダイレクトされます。
        </p>
      </div>
    </div>
  )
}