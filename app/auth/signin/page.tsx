'use client'

import { signIn, getProviders } from 'next-auth/react'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ThemeToggle from '@/app/components/ThemeToggle'

// SearchParams を使用するコンポーネントを分離
function SignInContent() {
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
        'OAuthAccountNotLinked': 'このメールアドレスは既に別の方法で登録されています。別のログイン方法をお試しください。',
        'CredentialsSignin': 'メールアドレスまたはパスワードが間違っています。入力内容をご確認ください。',
        'USER_NOT_FOUND': '入力されたメールアドレスは登録されていません。新規会員登録をお試しください。',
        'OAUTH_USER_NO_PASSWORD': 'このアカウントはOAuth認証（GitHub/Google）で登録されています。該当のサービスでログインしてください。',
        'INVALID_PASSWORD': 'パスワードが間違っています。正しいパスワードを入力してください。'
      }
      
      // エラーコードと日本語メッセージを両方表示
      const message = errorMessages[errorParam] || errorMessages['Default']
      const displayError = errorParam === 'CredentialsSignin' ? 
        `認証エラー: ${message}` : 
        message
      
      setError(displayError)
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
      console.log('=== OAuth認証開始 ===')
      console.log(`プロバイダー: ${provider}`)
      console.log('環境変数:', {
        NEXTAUTH_URL: process.env.NEXT_PUBLIC_NEXTAUTH_URL,
        hasGithub: !!providers?.github,
        hasGoogle: !!providers?.google
      })
      
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
      
      console.log('=== OAuth認証リクエスト開始 ===')
      console.log('設定値:', {
        provider,
        callbackUrl: '/dashboard',
        redirect: true,
        NEXTAUTH_URL: process.env.NEXT_PUBLIC_NEXTAUTH_URL,
        windowLocation: typeof window !== 'undefined' ? window.location.href : 'undefined'
      })

      const result = await signIn(provider, {
        callbackUrl: '/dashboard',
        redirect: true, // 自動リダイレクトを有効化
      })
      
      console.log('=== OAuth認証結果 ===')
      console.log('結果:', result)
      console.log('プロバイダー状態:', {
        github: providers?.github,
        google: providers?.google
      })
      
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
        // 詳細なエラーメッセージのマッピング
        const errorMessages: { [key: string]: string } = {
          'CredentialsSignin': 'メールアドレスまたはパスワードが間違っています。入力内容をご確認ください。',
          'USER_NOT_FOUND': '入力されたメールアドレスは登録されていません。新規会員登録をお試しください。',
          'OAUTH_USER_NO_PASSWORD': 'このアカウントはOAuth認証（GitHub/Google）で登録されています。該当のサービスでログインしてください。',
          'INVALID_PASSWORD': 'パスワードが間違っています。正しいパスワードを入力してください。'
        }
        
        const errorCode = result?.error || 'CredentialsSignin'
        const message = errorMessages[errorCode] || 'ログインに失敗しました。入力内容をご確認ください。'
        
        // エラーコードと日本語メッセージを両方表示
        setError(`認証エラー: ${message}`)
        
        // コンソールにデバッグ情報を出力
        console.error('ログイン失敗:', {
          errorCode,
          originalError: result?.error,
          email: formData.email
        })
      }
    } catch (err) {
      console.error('ログインエラー:', err)
      setError('ネットワークエラーが発生しました。しばらく後に再試行してください。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 dark:from-slate-900 dark:via-indigo-900 dark:to-purple-900 transition-all duration-500 px-3 sm:px-6">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            ✨ 個人用Todoアプリ
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            タスク管理で優雅な毎日を
          </p>
        </div>
        
        {/* エラーメッセージ */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800 dark:text-red-300 font-medium">{error}</p>
                {error.includes('OAuth認証') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    GitHubまたはGoogleのアカウントでログインしてください。
                  </p>
                )}
                {error.includes('登録されていません') && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    <Link href="/auth/register" className="underline hover:text-red-800 dark:hover:text-red-300">
                      こちらから新規会員登録
                    </Link>
                    ができます。
                  </p>
                )}
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
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Image
                      src="/icons/github.svg"
                      alt="GitHub"
                      width={16}
                      height={16}
                      className="dark:filter dark:invert"
                      onError={(e) => {
                        console.error('GitHub icon failed to load:', e)
                      }}
                      onLoad={() => {
                        console.log('GitHub icon loaded successfully')
                      }}
                    />
                  </span>
                  {isLoading ? '認証中...' : 'GitHubでログイン'}
                </button>
              )}

              {/* Google認証ボタン */}
              {providers?.google && (
                <button
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                    <Image
                      src="/icons/google.svg"
                      alt="Google"
                      width={16}
                      height={16}
                      onError={(e) => {
                        console.error('Google icon failed to load:', e)
                      }}
                      onLoad={() => {
                        console.log('Google icon loaded successfully')
                      }}
                    />
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                className="w-full text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
              >
                ← 他の方法でログイン
              </button>
            </>
          )}

          {/* 新規登録リンク */}
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              アカウントをお持ちでない方は
            </p>
            <Link 
              href="/auth/register" 
              className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors"
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

// ローディング中のフォールバック
function SignInLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 dark:from-slate-900 dark:via-indigo-900 dark:to-purple-900 transition-all duration-500 px-3 sm:px-6">
      <div className="max-w-md w-full space-y-6 sm:space-y-8 p-4 sm:p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-end mb-4">
            <ThemeToggle />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            ✨ 個人用Todoアプリ
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            タスク管理で優雅な毎日を
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
        </div>
      </div>
    </div>
  )
}

// メインコンポーネント（Suspense境界あり）
export default function SignIn() {
  return (
    <Suspense fallback={<SignInLoading />}>
      <SignInContent />
    </Suspense>
  )
}