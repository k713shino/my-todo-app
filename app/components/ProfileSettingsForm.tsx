'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import Image from 'next/image'

interface ProfileSettingsFormProps {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export default function ProfileSettingsForm({ user }: ProfileSettingsFormProps) {
  const { data: session, update } = useSession()
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || ''
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim()
        })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        toast.success('プロフィールが更新されました')
        console.log('セッション更新前:', {
          sessionImage: session?.user.image,
          dataImage: data.user.image
        })
        // セッション更新（image属性を保持）
        await update({
          ...session,
          user: {
            ...session?.user,
            name: formData.name,
            email: formData.email,
            image: data.user.image || session?.user.image
          }
        })
        console.log('セッション更新後:', {
          newImage: session?.user.image
        })
      } else {
        toast.error(data.error || 'プロフィール更新に失敗しました')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📝 基本情報
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 表示名 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            表示名
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="表示名を入力"
            disabled={isLoading}
          />
        </div>

        {/* メールアドレス */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            メールアドレス
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="メールアドレス"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            メールアドレス変更時は確認メールが送信されます
          </p>
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading}
        >
          {isLoading ? '更新中...' : 'プロフィールを更新'}
        </button>
      </form>

      {/* OAuth接続情報 */}
      <div className="mt-6 pt-6 border-t">
        <h4 className="text-sm font-medium text-gray-900 mb-3">🔗 接続済みアカウント</h4>
        <div className="space-y-2">
          {user.image && (
            <div>
              <div className="flex items-center space-x-3">
                <Image
                  src={user.image}
                  alt="プロフィール画像"
                  width={32}
                  height={32}
                  className="rounded-full"
                  unoptimized
                />
                <span className="text-sm text-gray-600">プロフィール画像</span>
              </div>
            </div>
          )}
          <p className="text-sm text-gray-500">
            OAuth経由でログインしている場合、一部の情報は連携元サービスで管理されます。
          </p>
        </div>
      </div>
    </div>
  )
}