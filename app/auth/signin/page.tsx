'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function SignIn() {
  const [isLoading, setIsLoading] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [providers, setProviders] = useState<any>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  // URLパラメータからエラーを取得
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const errorMessages: { [key: string]: string } = {
        'Configuration': 'OAuth設定に問題があります。管理者にお問い合わせください。',
        'AccessDenied': 'アクセスが拒否されました。',
        'Verification': '認証に失敗しました。',
        'Default': 'ログインに失敗しました。しばらく後に再試行してください。',
        'OAuthCallback': 'OAuth認証でエラーが発生しました。設定を確認してください。',
        'OAuthAccountNotLinked': 'このメールアドレスは既に別の方法で登録されています。',
        'CredentialsSignin': 'メールアドレスまたはパスワードが間違っています。'
      }
      setError(errorMessages[errorParam] || errorMessages['Default'])
    }
  }, [searchParams])

  // プロバイダー情報を取得
  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders()
      setProviders(res)
    }
    fetchProviders()
  }, [])

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setIsLoading(true)
    setError('')
    
    try {
      console.log(`${provider}認証を開始...`)
      
      // 環境変数チェック
      const hasGithub = providers?.github
      const hasGoogle = providers?.google
      
      if (provider === 'github' && !hasGithub) {
        setError('GitHub認証が設定されていません。管理者にお問い合わせください。')
        setIsLoading(false)
        return
      }
      
      if (provider === 'google' && !hasGoogle) {
        setError('Google認証が設定されていません。管理者にお問い合わせください。')
        setIsLoading(false)
        return
      }
      
      const result = await signIn(provider, {
        callbackUrl: '/dashboard',
        redirect: true, // 自動リダイレクトを有効化
      })
      
      console.log('認証結果:', result)
      
    } catch (err) {
      console.error('ログインエラー:', err)
      setError('ログインに失敗しました。もう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })
      
      if (result?.ok) {
        router.push('/dashboard')
      } else {
        setError(result?.error || 'メールアドレスまたはパスワードが間違っています')
      }
    } catch (err) {
      console.error('ログインエラー:', err)
      setError('ログインに失敗しました')
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
        
        <div className="mt-8 space-y-6">
          {!showEmailLogin ? (
            // OAuth ログイン画面
            <>
              {/* GitHub認証ボタン */}
              {providers?.github && (
                <button
                  onClick={() => handleOAuthSignIn('github')}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    🐙
                  </span>
                  {isLoading ? '認証中...' : 'GitHubでログイン'}
                </button>
              )}

              {/* Google認証ボタン */}
              {providers?.google && (
                <button
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    🔴
                  </span>
                  {isLoading ? '認証中...' : 'Googleでログイン'}
                </button>
              )}

              {/* OAuth設定チェック */}
              {!providers?.github && !providers?.google && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-sm text-yellow-800">
                    OAuth認証が設定されていません。メールアドレスでのログインをご利用ください。
                  </p>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">または</span>
                </div>
              </div>

              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all duration-200"
              >
                📧 メールアドレスでログイン
              </button>
            </>
          ) : (
            // メールアドレス ログイン画面
            <>
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="パスワードを入力"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? 'ログイン中...' : 'ログイン'}
                </button>
              </form>

              <button
                onClick={() => setShowEmailLogin(false)}
                className="w-full text-sm text-purple-600 hover:text-purple-800 transition-colors"
              >
                ← 他の方法でログイン
              </button>
            </>
          )}

          {/* 新規登録リンク */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              アカウントをお持ちでない方は
            </p>
            <Link 
              href="/auth/register" 
              className="text-purple-600 hover:text-purple-800 font-medium transition-colors"
            >
              新規会員登録
            </Link>
          </div>

          {/* デバッグ情報（開発環境のみ） */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-400 p-2 bg-gray-50 rounded">
              <p>利用可能な認証方法:</p>
              <ul>
                {providers?.github && <li>✅ GitHub</li>}
                {providers?.google && <li>✅ Google</li>}
                <li>✅ メールアドレス</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}