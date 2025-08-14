'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface DatabaseUser {
  userId: string
  todoCount: number
  completedCount: number
  sampleTodos: Array<{
    id: string
    title: string
    category: string | null
    createdAt: string
  }>
  lastActivity: number
}

export default function AccountLinkingSection() {
  const { data: session } = useSession()
  const [availableUsers, setAvailableUsers] = useState<DatabaseUser[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [linkResult, setLinkResult] = useState<any>(null)

  useEffect(() => {
    if (session?.user) {
      fetchAvailableUsers()
    }
  }, [session])

  const fetchAvailableUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/link-account')
      const data = await response.json()
      
      if (data.success) {
        setAvailableUsers(data.availableDbUsers)
      } else {
        console.error('Failed to fetch users:', data.error)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const linkAccount = async (databaseUserId: string) => {
    try {
      setLinking(true)
      const response = await fetch('/api/user/link-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ databaseUserId })
      })
      
      const result = await response.json()
      setLinkResult(result)
      
      if (result.success) {
        // 成功時の処理（リロードまたは状態更新）
        console.log('Account linked successfully:', result)
      }
    } catch (error) {
      console.error('Error linking account:', error)
      setLinkResult({ error: 'Linking failed' })
    } finally {
      setLinking(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!session?.user) {
    return <div>認証が必要です</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-yellow-800 mb-2">
          🔗 アカウント連携設定
        </h3>
        <p className="text-yellow-700 mb-4">
          OAuth認証ID（<code className="bg-yellow-100 px-2 py-1 rounded">{session.user.id}</code>）と
          データベースユーザーIDを連携してください。
        </p>
        
        {linkResult && (
          <div className={`mb-4 p-3 rounded ${linkResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {linkResult.success ? (
              <div>
                <p>✅ アカウント連携が確認されました！</p>
                <p>データベースユーザーID: <code>{linkResult.linkedAccount?.databaseUserId}</code></p>
                <p>Todo数: {linkResult.linkedAccount?.todoCount}</p>
              </div>
            ) : (
              <p>❌ {linkResult.error}</p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">利用可能なユーザーを取得中...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">利用可能なデータベースユーザー</h4>
          
          {availableUsers.length === 0 ? (
            <p className="text-gray-500">利用可能なユーザーが見つかりません。</p>
          ) : (
            <div className="grid gap-4">
              {availableUsers.map((user) => (
                <div key={user.userId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-mono text-sm text-gray-600">{user.userId}</p>
                      <p className="text-sm text-gray-500">
                        最終活動: {formatDate(user.lastActivity)}
                      </p>
                    </div>
                    <button
                      onClick={() => linkAccount(user.userId)}
                      disabled={linking}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {linking ? '確認中...' : 'このアカウントを使用'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-sm">
                      <span className="text-gray-600">Todo数:</span>
                      <span className="ml-2 font-medium">{user.todoCount}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600">完了数:</span>
                      <span className="ml-2 font-medium">{user.completedCount}</span>
                    </div>
                  </div>
                  
                  {user.sampleTodos.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">サンプルTodo:</p>
                      <ul className="text-sm space-y-1">
                        {user.sampleTodos.map((todo) => (
                          <li key={todo.id} className="text-gray-700">
                            • {todo.title}
                            {todo.category && (
                              <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                {todo.category}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}