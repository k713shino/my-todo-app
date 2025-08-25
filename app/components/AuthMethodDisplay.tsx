'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { getAuthMethodFromUserId } from '@/lib/user-id-utils'

interface AuthMethod {
  provider: string
  providerAccountId: string
}

interface AuthMethodDisplayProps {
  className?: string
}

export default function AuthMethodDisplay({ className = '' }: AuthMethodDisplayProps) {
  const { data: session } = useSession()
  const [authMethods, setAuthMethods] = useState<AuthMethod[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAuthMethods = async () => {
      if (!session?.user?.id) return

      // ユーザーIDから認証方法を判定
      const authMethod = getAuthMethodFromUserId(session.user.id)
      
      // 認証方法に基づいてデータを設定
      const detectedAuthMethod: AuthMethod = {
        provider: authMethod === 'unknown' ? 'credentials' : authMethod,
        providerAccountId: authMethod === 'email' ? 'email' : session.user.id.split('_')[1] || 'unknown'
      }

      try {
        const response = await fetch('/api/user/auth-methods')
        if (response.ok) {
          const data = await response.json()
          console.log('認証方法データ:', data)
          // APIからデータが取得できた場合はそちらを使用、できない場合は検出した認証方法を使用
          setAuthMethods(data.authMethods && data.authMethods.length > 0 ? data.authMethods : [detectedAuthMethod])
        } else {
          console.error('認証方法取得エラー:', response.status, response.statusText)
          // エラーの場合は検出した認証方法を使用
          setAuthMethods([detectedAuthMethod])
        }
      } catch (error) {
        console.error('Failed to fetch auth methods:', error)
        // エラーの場合は検出した認証方法を使用
        setAuthMethods([detectedAuthMethod])
      } finally {
        setIsLoading(false)
      }
    }

    fetchAuthMethods()
  }, [session?.user?.id])

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return '🔍'
      case 'github':
        return '🐙'
      case 'credentials':
        return '📧'
      default:
        return '🔐'
    }
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google OAuth'
      case 'github':
        return 'GitHub OAuth'
      case 'credentials':
        return 'メールアドレス認証'
      default:
        return provider
    }
  }

  if (isLoading) {
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        認証方法を読み込み中...
      </div>
    )
  }

  if (authMethods.length === 0) {
    // セッションから認証方法を推定
    const authMethod = session?.user?.id ? getAuthMethodFromUserId(session.user.id) : 'email'
    const providerName = getProviderName(authMethod === 'unknown' ? 'credentials' : authMethod)
    const providerIcon = getProviderIcon(authMethod === 'unknown' ? 'credentials' : authMethod)
    
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        {providerIcon} {providerName}
      </div>
    )
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        🔐 認証方法
      </h3>
      <div className="space-y-1">
        {authMethods.map((method, index) => (
          <div
            key={index}
            className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <span>{getProviderIcon(method.provider)}</span>
            <span>{getProviderName(method.provider)}</span>
            {method.provider !== 'credentials' && (
              <span className="text-xs text-gray-500 dark:text-gray-500">
                (ID: {method.providerAccountId.substring(0, 8)}...)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}