'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import toast from 'react-hot-toast'

interface OAuthAccount {
  provider: string
  providerAccountId: string
}

export default function OAuthManagementForm() {
  const { data: session, update } = useSession()
  const [oauthAccounts, setOauthAccounts] = useState<OAuthAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRevoking, setIsRevoking] = useState<string | null>(null)

  // OAuth連携情報を取得
  const fetchOAuthAccounts = async () => {
    try {
      const response = await fetch('/api/auth/oauth-accounts')
      if (response.ok) {
        const data = await response.json()
        setOauthAccounts(data.accounts || [])
      }
    } catch (error) {
      console.error('OAuth accounts fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // OAuth連携を削除
  const handleRevokeOAuth = async (provider: string) => {
    const providerNames = {
      github: 'GitHub',
      google: 'Google'
    }

    const confirmMessage = `
${providerNames[provider as keyof typeof providerNames] || provider}連携を削除しますか？

削除後は${providerNames[provider as keyof typeof providerNames]}でのログインができなくなります。
この操作は取り消せません。

削除を続行しますか？
    `.trim()

    if (!confirm(confirmMessage)) {
      return
    }

    setIsRevoking(provider)
    
    try {
      const response = await fetch('/api/auth/revoke-oauth', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success(`${providerNames[provider as keyof typeof providerNames]}連携が削除されました`)
        
        // OAuth連携リストを更新
        await fetchOAuthAccounts()
        
        // セッション更新
        await update()
        
        // 削除したプロバイダーが現在のログイン方法の場合、ログアウト
        if (session?.user?.email && oauthAccounts.length === 1) {
          toast('認証方法が変更されたため、再ログインが必要です', {
            icon: 'ℹ️',
            duration: 4000,
          })
          setTimeout(() => {
            signOut({ callbackUrl: '/auth/signin' })
          }, 2000)
        }
        
      } else {
        toast.error(data.error || 'OAuth連携の削除に失敗しました')
      }
    } catch (error) {
      console.error('OAuth revocation error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsRevoking(null)
    }
  }

  useEffect(() => {
    fetchOAuthAccounts()
  }, [])

  const providerConfig = {
    github: {
      name: 'GitHub',
      icon: '🐙',
      color: 'bg-gray-800 text-white',
      description: 'GitHubアカウントでログイン'
    },
    google: {
      name: 'Google',
      icon: '🔴',
      color: 'bg-red-600 text-white',
      description: 'Googleアカウントでログイン'
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔗 連携サービス管理
      </h3>

      {oauthAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-4">🔐</div>
          <p>連携中のOAuthサービスはありません</p>
          <p className="text-sm mt-2">
            ログイン画面からGitHubやGoogleアカウントを連携できます
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {oauthAccounts.map((account) => {
            const config = providerConfig[account.provider as keyof typeof providerConfig]
            if (!config) return null

            return (
              <div
                key={account.provider}
                className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full ${config.color} flex items-center justify-center text-2xl`}>
                    {config.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{config.name}</h4>
                    <p className="text-sm text-gray-600">{config.description}</p>
                    <p className="text-xs text-gray-400">
                      ID: {account.providerAccountId}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleRevokeOAuth(account.provider)}
                  disabled={isRevoking === account.provider}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRevoking === account.provider ? '削除中...' : '連携解除'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-800 mb-2">⚠️ 重要な注意事項</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• OAuth連携を削除すると、該当サービスでのログインができなくなります</li>
          <li>• 最後の認証方法を削除する前に、パスワードを設定するか他の連携を追加してください</li>
          <li>• 削除操作は取り消すことができません</li>
          <li>• 外部サービス側でもトークンが無効化されます</li>
        </ul>
      </div>

      {/* パスワード認証の状態表示 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">🔐 認証方法の状態</h4>
        <div className="text-sm text-blue-700">
          <p>パスワード認証: {session?.user?.hasPassword ? '✅ 設定済み' : '❌ 未設定'}</p>
          <p>OAuth連携: {oauthAccounts.length}個のサービス</p>
          {!session?.user?.hasPassword && oauthAccounts.length === 1 && (
            <p className="text-red-600 font-medium mt-2">
              ⚠️ 認証方法が1つしかありません。連携削除前にパスワードを設定することを強く推奨します。
            </p>
          )}
        </div>
      </div>
    </div>
  )
}