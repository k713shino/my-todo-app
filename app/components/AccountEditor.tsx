'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface AccountEditorProps {
  className?: string
}

export default function AccountEditor({ className = '' }: AccountEditorProps) {
  const { data: session, update } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: session?.user?.name || '',
    image: session?.user?.image || ''
  })

  // フォームデータをセッション変更時に同期
  useEffect(() => {
    if (session?.user) {
      setFormData({
        name: session.user.name || '',
        image: session.user.image || ''
      })
    }
  }, [session?.user?.name, session?.user?.image])

  const handleSave = async () => {
    if (!session?.user) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/user/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          image: formData.image
        }),
      })

      if (!response.ok) {
        throw new Error('アカウント情報の更新に失敗しました')
      }

      const result = await response.json()
      console.log('Update response:', result)

      // セッションを更新
      if (session?.user && result.success) {
        console.log('Updating session with:', result.user)
        
        try {
          // セッション更新を実行
          const updateResult = await update({
            name: result.user.name,
            image: result.user.image
          })
          
          console.log('Session update result:', updateResult)
          
          // セッション更新を確実に反映させるため少し待機
          await new Promise(resolve => setTimeout(resolve, 200))
          
          // フォームデータも即座に更新
          setFormData({
            name: result.user.name || '',
            image: result.user.image || ''
          })
          
        } catch (sessionError) {
          console.error('Session update error:', sessionError)
          
          // セッション更新に失敗した場合でもフォームデータは更新
          setFormData({
            name: result.user.name || '',
            image: result.user.image || ''
          })
        }
      }

      setIsEditing(false)
      toast.success('アカウント情報を更新しました')
    } catch (error) {
      console.error('Account update error:', error)
      toast.error('アカウント情報の更新に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: session?.user?.name || '',
      image: session?.user?.image || ''
    })
    setIsEditing(false)
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-4">
        {(formData.image || session.user.image) && (
          <Image
            src={formData.image || session.user.image!}
            alt="プロフィール"
            width={64}
            height={64}
            className="rounded-full"
            unoptimized
          />
        )}
        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ユーザーネーム
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ユーザーネームを入力"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  プロフィール画像URL
                </label>
                <input
                  type="url"
                  value={formData.image}
                  onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="画像URLを入力"
                />
              </div>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {session.user.name}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {session.user.email}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '保存中...' : '💾 保存'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ❌ キャンセル
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm"
          >
            ✏️ 編集
          </button>
        )}
      </div>
    </div>
  )
}