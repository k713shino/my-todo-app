'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface AccountDeletionProps {
  className?: string
}

export default function AccountDeletion({ className = '' }: AccountDeletionProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmationText, setConfirmationText] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleDeleteAccount = async () => {
    if (!session?.user) return
    
    if (confirmationText !== 'DELETE') {
      toast.error('確認テキストが正しくありません')
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('アカウント削除に失敗しました')
      }

      toast.success('アカウントを削除しました')
      
      // サインアウトしてホームページにリダイレクト
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      console.error('Account deletion error:', error)
      toast.error('アカウント削除に失敗しました')
    } finally {
      setIsDeleting(false)
    }
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="border border-red-200 dark:border-red-600 rounded-lg p-4">
        <h3 className="font-medium text-red-900 dark:text-red-400 mb-2">
          ⚠️ アカウント削除
        </h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-3">
          アカウントとすべてのデータを完全に削除します。この操作は取り消せません。
        </p>
        
        {!showConfirmation ? (
          <button
            onClick={() => setShowConfirmation(true)}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors text-sm"
          >
            🗑️ アカウントを削除
          </button>
        ) : (
          <div className="space-y-3">
            <div className="bg-red-50 dark:bg-red-900 p-3 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium mb-2">
                本当にアカウントを削除しますか？
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                この操作により以下のデータが完全に削除されます：
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside mb-3">
                <li>すべてのTodoアイテム</li>
                <li>保存された検索履歴</li>
                <li>アカウント情報</li>
                <li>OAuth連携情報</li>
              </ul>
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                続行するには「DELETE」と入力してください：
              </p>
            </div>
            
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE と入力"
              className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || confirmationText !== 'DELETE'}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? '削除中...' : '❌ 完全に削除する'}
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false)
                  setConfirmationText('')
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}