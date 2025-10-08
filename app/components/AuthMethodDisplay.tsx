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
      
      // NextAuthのセッションから追加情報を取得
      console.log('セッション情報:', session)
      console.log('検出された認証方法:', authMethod)
      
      // 認証方法に基づいてデータを設定
      const detectedAuthMethod: AuthMethod = {
        provider: authMethod === 'unknown' ? 'credentials' : authMethod,
        providerAccountId: authMethod === 'email' ? 'email' : session.user.id.split('_')[1] || 'unknown'
      }

      // セッション情報から直接認証方法を判定して設定
      setAuthMethods([detectedAuthMethod])
      setIsLoading(false)
    }

    fetchAuthMethods()
  }, [session])

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