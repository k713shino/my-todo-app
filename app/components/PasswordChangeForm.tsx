'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { getAuthMethodFromUserId } from '@/lib/user-id-utils'
import PasswordStrengthIndicator from './PasswordStrengthIndicator'
import PasswordChangeModal from './PasswordChangeModal'
import { validatePassword } from '@/lib/password-validation'

export default function PasswordChangeForm() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [modalState, setModalState] = useState({
    isOpen: false,
    success: false,
    message: ''
  })

  // クレデンシャル認証でない場合は表示しない
  if (!session?.user?.id) return null
  
  const authMethod = getAuthMethodFromUserId(session.user.id)
  if (authMethod !== 'email') {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.newPassword !== formData.confirmPassword) {
      setModalState({
        isOpen: true,
        success: false,
        message: '新しいパスワードが一致しません。もう一度確認してください。'
      })
      return
    }

    const passwordValidation = validatePassword(formData.newPassword)
    if (!passwordValidation.isValid) {
      setModalState({
        isOpen: true,
        success: false,
        message: 'パスワードが要件を満たしていません。\n' + passwordValidation.feedback.join('\n')
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'パスワードの変更に失敗しました')
      }

      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setModalState({
        isOpen: true,
        success: true,
        message: 'パスワードが正常に変更されました。次回ログイン時から新しいパスワードをご利用ください。'
      })
    } catch (error) {
      console.error('Password change error:', error)
      setModalState({
        isOpen: true,
        success: false,
        message: error instanceof Error ? error.message : 'パスワードの変更に失敗しました。しばらく時間を置いてから再度お試しください。'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        🔐 パスワード変更
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            現在のパスワード
          </label>
          <input
            type="password"
            value={formData.currentPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            新しいパスワード
          </label>
          <input
            type="password"
            value={formData.newPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            minLength={8}
            required
          />
          {formData.newPassword && (
            <PasswordStrengthIndicator 
              password={formData.newPassword}
              showRequirements={true}
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            新しいパスワード（確認）
          </label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !validatePassword(formData.newPassword).isValid}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '変更中...' : 'パスワードを変更'}
        </button>
      </form>
      
      <PasswordChangeModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, success: false, message: '' })}
        success={modalState.success}
        message={modalState.message}
      />
    </div>
  )
}
