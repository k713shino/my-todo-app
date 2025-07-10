'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
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
        alert(errorData.error)
      }
    } catch (err) {
      console.error('Registration error:', err)
      alert('エラーが発生しました')
    } finally {
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
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              お名前
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
              required
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
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
              required
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
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
              required
              minLength={8}
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? '登録中...' : '会員登録'}
          </button>
        </form>
        
        <div className="text-center space-y-4">
          <p>または</p>
          <button
            onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
            className="w-full py-3 px-4 bg-gray-800 text-white rounded-md"
          >
            GitHubで登録
          </button>
          <button
            onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
            className="w-full py-3 px-4 bg-red-600 text-white rounded-md"
          >
            Googleで登録
          </button>
        </div>
        
        <div className="text-center">
          <Link href="/auth/signin" className="text-blue-600 hover:text-blue-800">
            すでにアカウントをお持ちの方はこちら
          </Link>
        </div>
      </div>
    </div>
  )
}