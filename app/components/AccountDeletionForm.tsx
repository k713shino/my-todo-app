'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast as _toast } from 'react-hot-toast'
import AccountDeletionResultModal from './AccountDeletionResultModal'

export default function AccountDeletionForm() {
  const { data: session } = useSession()
  const _router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [formData, setFormData] = useState({
    confirmationText: '',
    password: '',
    reason: ''
  })
  const [error, setError] = useState('')
  const [modalResult, setModalResult] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
    details?: {
      todoCount?: number
      authMethod?: string
      memberSince?: string
      deletedAt?: string
    }
    errorCode?: string
  } | null>(null)
  const [showModal, setShowModal] = useState(false)

  const reasons = [
    '他のサービスに移行するため',
    'アプリを使用しなくなったため', 
    'プライバシーの懸念',
    'セキュリティ上の理由',
    'アカウント整理のため',
    'その他'
  ]

  const handleInitialDelete = () => {
    setShowConfirmation(true)
    setError('')
  }

  const handleFinalDelete = async () => {
    setError('')
    
    if (!formData.confirmationText || formData.confirmationText !== 'DELETE') {
      setError('確認テキスト「DELETE」を正確に入力してください')
      return
    }

    // パスワード認証ユーザーの場合、パスワード必須
    if (session?.user?.hasPassword && !formData.password) {
      setError('パスワードを入力してください')
      return
    }

    const confirmMessage = `
本当にアカウントを削除しますか？

この操作は取り消すことができません。
- すべてのTodoデータが永久に削除されます
- ログイン情報が削除されます  
- アカウントに関連するすべてのデータが削除されます

削除を継続する場合は「OK」をクリックしてください。
    `.trim()

    if (!confirm(confirmMessage)) {
      return
    }

    setIsDeleting(true)
    
    try {
      console.log('🗑️ Starting account deletion...')
      
      const requestBody = {
        confirmationText: formData.confirmationText,
        password: formData.password,
        reason: formData.reason
      }
      
      console.log('📤 Sending deletion request:', {
        confirmationText: requestBody.confirmationText,
        hasPassword: !!requestBody.password,
        reason: requestBody.reason
      })
      
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(requestBody)
      })
      
      console.log('📥 Deletion response status:', response.status)
      
      // レスポンスの処理
      let data
      try {
        const responseText = await response.text()
        console.log('📄 Raw response:', responseText)
        
        if (responseText) {
          data = JSON.parse(responseText)
        } else {
          data = { error: 'サーバーからの応答が空です' }
        }
      } catch (parseError) {
        console.error('JSON parse error:', parseError)
        data = { error: 'サーバー応答の解析に失敗しました' }
      }
      
      if (response.ok) {
        console.log('✅ Account deletion successful:', data)
        
        // 成功モーダルを表示
        setModalResult({
          type: 'success',
          title: 'アカウント削除完了',
          message: 'アカウントが正常に削除されました。すべてのデータがGDPR準拠で完全に削除されました。',
          details: {
            todoCount: data.stats?.todoCount,
            authMethod: data.stats?.authMethod,
            memberSince: data.stats?.memberSince,
            deletedAt: data.deletedAt
          }
        })
        setShowModal(true)
        
        // ログアウト処理
        try {
          await signOut({ redirect: false })
        } catch (signOutError) {
          console.error('Sign out error:', signOutError)
        }
      } else {
        console.error('❌ Account deletion failed:', data)
        setError(data.error || `削除に失敗しました (ステータス: ${response.status})`)
        
        // エラーモーダルを表示
        let errorTitle = 'アカウント削除エラー'
        if (data.maintenanceMode) {
          errorTitle = 'データベースメンテナンス中'
        } else if (response.status === 401) {
          errorTitle = '認証エラー'
        } else if (response.status === 400) {
          errorTitle = '入力エラー'
        }
        
        setModalResult({
          type: 'error',
          title: errorTitle,
          message: data.error || 'アカウント削除に失敗しました。しばらく時間をおいてから再度お試しください。',
          errorCode: `HTTP ${response.status}`
        })
        setShowModal(true)
      }
    } catch (error) {
      console.error('❌ Account deletion network error:', error)
      setError('ネットワークエラーが発生しました。インターネット接続を確認してください。')
      
      // ネットワークエラーモーダルを表示
      setModalResult({
        type: 'error',
        title: 'ネットワークエラー',
        message: 'ネットワークエラーが発生しました。インターネット接続を確認してから再度お試しください。',
        errorCode: 'NETWORK_ERROR'
      })
      setShowModal(true)
    } finally {
      setIsDeleting(false)
    }
  }

  // セッション情報をデバッグ表示（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Session debug:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      hasPassword: session?.user?.hasPassword,
      authMethod: session?.user?.hasPassword ? 'credentials' : 'oauth'
    })
  }

  if (!showConfirmation) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-900 mb-4">
          ⚠️ アカウント削除
        </h3>
        
        {/* 認証方法の表示 */}
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <h4 className="font-medium text-blue-800 mb-2">📋 アカウント情報</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• メールアドレス: {session?.user?.email}</li>
            <li>• 認証方法: {session?.user?.hasPassword ? 'パスワード認証' : 'OAuth認証 (GitHub/Google)'}</li>
            <li>• アカウントID: {session?.user?.id}</li>
          </ul>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg mb-4">
          <h4 className="font-medium text-red-800 mb-2">削除されるデータ</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• すべてのTodoアイテム</li>
            <li>• アカウント情報（名前、メール等）</li>
            <li>• ログイン履歴・セッション</li>
            <li>• OAuth接続情報</li>
            <li>• プロフィール設定</li>
            <li>• その他すべての関連データ</li>
          </ul>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg mb-4">
          <h4 className="font-medium text-yellow-800 mb-2">⚠️ 重要な注意事項</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• この操作は<strong>取り消すことができません</strong></li>
            <li>• データの復旧は一切できません</li>
            <li>• 削除後は同じメールアドレスで再登録可能です</li>
            <li>• GDPR準拠の完全削除が実行されます</li>
          </ul>
        </div>

        <button
          onClick={handleInitialDelete}
          className="w-full px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors font-medium"
        >
          アカウント削除を開始
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
      <h3 className="text-lg font-semibold text-red-900 mb-4">
        🚨 最終確認 - アカウント削除
      </h3>

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); handleFinalDelete(); }}>
          {/* 削除理由 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              削除理由（オプション）
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isDeleting}
              autoComplete="off"
            >
              <option value="">選択してください</option>
              {reasons.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          {/* パスワード確認（パスワード認証の場合のみ） */}
          {session?.user?.hasPassword && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                パスワード確認 *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="現在のパスワードを入力"
                required
                disabled={isDeleting}
                autoComplete="current-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                セキュリティのため、現在のパスワードを入力してください
              </p>
            </div>
          )}

          {/* OAuth認証の場合の説明 */}
          {!session?.user?.hasPassword && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <p className="text-sm text-blue-700">
                <strong>OAuth認証アカウント</strong><br />
                GitHub/Google認証でログインしているため、パスワード確認は不要です。
              </p>
            </div>
          )}

          {/* 確認テキスト */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              確認テキスト *
            </label>
            <p className="text-sm text-gray-600 mb-2">
              削除を確認するため、下のボックスに <code className="bg-gray-100 px-1 rounded font-mono">DELETE</code> と正確に入力してください
            </p>
            <input
              type="text"
              value={formData.confirmationText}
              onChange={(e) => setFormData({...formData, confirmationText: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
              placeholder="DELETE"
              required
              disabled={isDeleting}
              autoComplete="off"
            />
            {formData.confirmationText && formData.confirmationText !== 'DELETE' && (
              <p className="text-sm text-red-600 mt-1">
                ❌ 「DELETE」と正確に入力してください（大文字小文字を区別します）
              </p>
            )}
          </div>

          {/* ボタン */}
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowConfirmation(false)
                setError('')
                setFormData({ confirmationText: '', password: '', reason: '' })
              }}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              disabled={isDeleting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              disabled={
                isDeleting || 
                formData.confirmationText !== 'DELETE' || 
                (session?.user?.hasPassword && !formData.password)
              }
            >
              {isDeleting ? '削除中...' : '完全に削除する'}
            </button>
          </div>
        </form>

        {/* 法的情報 */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📋 法的情報</h4>
          <p className="text-sm text-blue-700">
            この削除はGDPR（一般データ保護規則）およびその他のプライバシー法に準拠しています。
            削除処理は即座に実行され、すべてのデータが完全に削除されます。
          </p>
        </div>

        {/* デバッグ情報（開発環境のみ） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <strong>デバッグ情報:</strong><br />
            認証方法: {session?.user?.hasPassword ? 'パスワード' : 'OAuth'}<br />
            ユーザーID: {session?.user?.id}<br />
            確認テキスト: {formData.confirmationText}<br />
            パスワード入力: {formData.password ? '●●●●' : '（空）'}
          </div>
        )}
      </div>

      {/* アカウント削除結果モーダル */}
      <AccountDeletionResultModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        result={modalResult}
      />
    </div>
  )
}