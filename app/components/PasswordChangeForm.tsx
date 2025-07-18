'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import PasswordStrengthIndicator from './PasswordStrengthIndicator'

export default function PasswordChangeForm() {
  const { data: session } = useSession()
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  // パスワード要件チェック（フォーム送信用）
  const getPasswordRequirements = (password: string) => {
    return {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&]/.test(password)
    }
  }

  const getPasswordScore = (password: string) => {
    const requirements = getPasswordRequirements(password)
    return Object.values(requirements).filter(Boolean).length
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('パスワード変更フォームが送信されました')
    
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast.error('すべてのフィールドを入力してください')
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('新しいパスワードと確認パスワードが一致しません')
      return
    }

    const passwordScore = getPasswordScore(formData.newPassword)
    if (passwordScore < 3) {
      toast.error('パスワードが弱すぎます。より強力なパスワードを使用してください')
      return
    }

    setIsLoading(true)
    
    try {
      if (!session?.user?.email) {
        toast.error('セッションが無効です。再度ログインしてください。')
        return
      }

      console.log('パスワード変更APIを呼び出します')
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }),
        credentials: 'include'
      })
      
      const data = await response.json()
      console.log('APIレスポンスを受信:', {
        status: response.status,
        ok: response.ok,
        hasError: !!data.error,
        hasFailedRequirements: !!data.failedRequirements,
        errorMessage: data.error,
        responseData: data
      })
      
      if (response.ok) {
        toast.success('パスワードが正常に変更されました')
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else if (response.status === 401) {
        toast.error('セッションが無効です。再度ログインしてください。')
      } else if (response.status === 400) {
        // 400エラーの詳細を表示
        console.error('400エラーの詳細:', data)
        if (data.failedRequirements) {
          toast.error(data.error, { duration: 5000 })
        } else {
          toast.error(data.error || 'リクエストが無効です')
        }
      } else {
        toast.error(data.error || 'パスワード変更に失敗しました')
      }
    } catch (error) {
      console.error('パスワード変更エラー:', error)
      console.error('エラー詳細:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      toast.error('エラーが発生しました')
    } finally {
      setIsLoading(false)
    }
  }

  // OAuth認証ユーザーまたはパスワード認証でないユーザーの場合は表示しない
  if (!session?.user?.hasPassword) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800">
          OAuth認証（GitHub/Google）でログインしているため、パスワード変更は利用できません。
          連携元サービスでパスワードを管理してください。
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🔒 パスワード変更
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* アクセシビリティのためのhiddenユーザー名フィールド */}
        <input
          type="text"
          autoComplete="username"
          value={session?.user?.email || ''}
          aria-hidden="true"
          className="hidden"
          readOnly
        />
        {/* 現在のパスワード */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            現在のパスワード *
          </label>
          <div className="relative">
            <input
              type={showPasswords.current ? "text" : "password"}
              value={formData.currentPassword}
              onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.current ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* 新しいパスワード */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新しいパスワード *
          </label>
          <div className="relative">
            <input
              type={showPasswords.new ? "text" : "password"}
              value={formData.newPassword}
              onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.new ? '🙈' : '👁️'}
            </button>
          </div>
          
          {/* パスワード強度インジケーター */}
          <PasswordStrengthIndicator 
            password={formData.newPassword} 
            showRequirements={true} 
          />
        </div>

        {/* パスワード確認 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新しいパスワード（確認）*
          </label>
          <div className="relative">
            <input
              type={showPasswords.confirm ? "text" : "password"}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {showPasswords.confirm ? '🙈' : '👁️'}
            </button>
          </div>
          
          {/* パスワード一致確認 */}
          {formData.confirmPassword && (
            <div className="mt-1">
              {formData.newPassword === formData.confirmPassword ? (
                <p className="text-sm text-green-600">✅ パスワードが一致しています</p>
              ) : (
                <p className="text-sm text-red-600">❌ パスワードが一致しません</p>
              )}
            </div>
          )}
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          disabled={isLoading || formData.newPassword !== formData.confirmPassword}
        >
          {isLoading ? '変更中...' : 'パスワードを変更'}
        </button>
      </form>

      {/* セキュリティ注意事項 */}
      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
        <h4 className="text-sm font-medium text-yellow-800 mb-2">🛡️ セキュリティのヒント</h4>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• 定期的にパスワードを変更しましょう</li>
          <li>• 他のサイトと同じパスワードは使用しないでください</li>
          <li>• パスワードマネージャーの使用を推奨します</li>
          <li>• 不審なログイン活動があった場合は即座にパスワードを変更してください</li>
        </ul>
      </div>
    </div>
  )
}