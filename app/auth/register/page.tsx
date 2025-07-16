'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

// 登録フォームのメインコンポーネント
function RegisterContent() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        alert('会員登録が完了しました！ログインしてください。')
        // 自動ログイン
        await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          callbackUrl: '/dashboard'
        })
      } else {
        const errorData = await response.json()
        setError(errorData.error || '登録に失敗しました')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthRegister = async (provider: 'github' | 'google') => {
    setIsLoading(true)
    setError('')
    
    try {
      await signIn(provider, { 
        callbackUrl: '/dashboard',
        redirect: true 
      })
    } catch (err) {
      console.error('OAuth registration error:', err)
      setError('OAuth登録に失敗しました')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            新規会員登録
          </h2>
        </div>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              お名前
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              メールアドレス
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              パスワード（8文字以上）
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '登録中...' : '会員登録'}
          </button>
        </form>
        
        <div className="text-center space-y-4">
          <p>または</p>
          
          <button
            onClick={() => handleOAuthRegister('github')}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gray-800 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="inline-flex items-center">
              🐙 GitHubで登録
            </span>
          </button>
          
          <button
            onClick={() => handleOAuthRegister('google')}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span className="inline-flex items-center">
              🔴 Googleで登録
            </span>
          </button>
        </div>
        
        <div className="text-center">
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-800 transition-colors">
            すでにアカウントをお持ちの方はこちら
          </Link>
        </div>
      </div>
    </div>
  )
}

// ローディング中のフォールバック
function RegisterLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-2xl">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            新規会員登録
          </h2>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    </div>
  )
}

// メインコンポーネント（Suspense境界あり）
export default function Register() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterContent />
    </Suspense>
  )
}