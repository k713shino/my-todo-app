'use client'

import { signIn, getSession } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleGitHubSignIn = async () => {
    setIsLoading(true)
    try {
      const result = await signIn('github', {
        callbackUrl: '/dashboard',
        redirect: false,
      })
      
      if (result?.ok) {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('ログインエラー:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-500 to-red-500">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            ✨ 個人用Todoアプリ
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            タスク管理で優雅な毎日を
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <button
            onClick={handleGitHubSignIn}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              🐙
            </span>
            {isLoading ? '認証中...' : 'GitHubでログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}
