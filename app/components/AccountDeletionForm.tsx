'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function AccountDeletionForm() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [formData, setFormData] = useState({
    confirmationText: '',
    password: '',
    reason: ''
  })

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
  }

  const handleFinalDelete = async () => {
    if (!formData.confirmationText || formData.confirmationText !== 'DELETE') {
      toast.error('確認テキスト「DELETE」を正確に入力してください')
      return
    }

    // パスワード認証ユーザーの場合、パスワード必須
    if (session?.user?.hasPassword && !formData.password) {
      toast.error('パスワードを入力してください')
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
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationText: formData.confirmationText,
          password: formData.password,
          reason: formData.reason
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('アカウントが正常に削除されました')
        
        // ログアウトして削除完了ページへ
        await signOut({ redirect: false })
        router.push('/account-deleted')
      } else {
        toast.error(data.error || 'アカウント削除に失敗しました')
      }
    } catch (error) {
      console.error('Account deletion error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!showConfirmation) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
        <h3 className="text-lg font-semibold text-red-900 mb-4">
          ⚠️ アカウント削除
        </h3>
        
        <div className="bg-red-50 p-4 rounded-lg mb-4">
          <h4 className="font-medium text-red-800 mb-2">削除されるデータ</h4>
          <ul className="text-sm text-red-700 space-y-1">
            <li>• すべてのTodoアイテム</li>
            <li>• アカウント情報（名前、メール等）</li>
            <li>• ログイン履歴・セッション</li>
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

      <div className="space-y-4">
        {/* 削除理由 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            削除理由（オプション）
          </label>
          <select
            value={formData.reason}
            onChange={(e) => setFormData({...formData, reason: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={isDeleting}
          >
            <option value="">選択してください</option>
            {reasons.map(reason => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>
        </div>

        {/* パスワード確認（必要な場合） */}
        {session?.user?.hasPassword && (
          <div>
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
            />
          </div>
        )}

        {/* 確認テキスト */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            確認テキスト *
          </label>
          <p className="text-sm text-gray-600 mb-2">
            削除を確認するため、下のボックスに <code className="bg-gray-100 px-1 rounded">DELETE</code> と入力してください
          </p>
          <input
            type="text"
            value={formData.confirmationText}
            onChange={(e) => setFormData({...formData, confirmationText: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder="DELETE"
            required
            disabled={isDeleting}
          />
        </div>

        {/* ボタン */}
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConfirmation(false)}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            disabled={isDeleting}
          >
            キャンセル
          </button>
          <button
            onClick={handleFinalDelete}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            disabled={isDeleting || formData.confirmationText !== 'DELETE' || (session?.user?.hasPassword && !formData.password)}
          >
            {isDeleting ? '削除中...' : '完全に削除する'}
          </button>
        </div>
      </div>
    </div>
  )
}