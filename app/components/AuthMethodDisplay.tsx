'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'

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

      try {
        const response = await fetch('/api/user/auth-methods')
        if (response.ok) {
          const data = await response.json()
          setAuthMethods(data.authMethods || [])
        }
      } catch (error) {
        console.error('Failed to fetch auth methods:', error)
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
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        📧 メールアドレス認証
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