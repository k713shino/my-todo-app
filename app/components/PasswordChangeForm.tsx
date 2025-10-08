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
  // 各パスワード入力の表示/非表示トグル
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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

      // 成否に関わらずJSONを読み、メッセージを適切に抽出
      const result = await response.json().catch(() => null as { success?: boolean; error?: string; message?: string } | null)

      if (!response.ok || (result && result.success === false)) {
        const apiMessage = result?.error || result?.message
        throw new Error(apiMessage || 'パスワードの変更に失敗しました')
      }

      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      setModalState({
        isOpen: true,
        success: true,
        message: (result && (result.message || result.success === true))
          ? (result.message || 'パスワードが正常に変更されました。次回ログイン時から新しいパスワードをご利用ください。')
          : 'パスワードが正常に変更されました。次回ログイン時から新しいパスワードをご利用ください。'
      })
    } catch (error) {
      console.error('Password change error:', error)
      const raw = error instanceof Error ? String(error.message || '') : ''
      // よくあるエラー文言を日本語に変換
      const normalized = (() => {
        const msg = raw.toLowerCase()
        if (msg.includes('incorrect') || msg.includes('invalid current password')) {
          return '現在のパスワードが正しくありません。'
        }
        if (msg.includes('at least 8') || msg.includes('8 characters')) {
          return '新しいパスワードは8文字以上である必要があります。'
        }
        if (msg.includes('unauthorized')) {
          return '認証に問題が発生しました。再ログインしてやり直してください。'
        }
        return raw || 'パスワードの変更に失敗しました。しばらく時間を置いてから再度お試しください。'
      })()
      setModalState({
        isOpen: true,
        success: false,
        message: normalized,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center">
        <span className="text-xl sm:text-2xl mr-2">🔐</span>
        <span>パスワード変更</span>
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            現在のパスワード
          </label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={formData.currentPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
              className="w-full px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrent(v => !v)}
              aria-pressed={showCurrent}
              title={showCurrent ? '非表示にする' : '表示する'}
              className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              {showCurrent ? (
                // eye-off icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.585 10.585A2 2 0 0012 14a2 2 0 001.414-.586" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.88 4.49A9.77 9.77 0 0112 4c7 0 10 8 10 8a13.37 13.37 0 01-3.288 4.793M6.228 6.228A13.377 13.377 0 002 12s3 8 10 8a9.77 9.77 0 002.12-.26" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                // eye icon
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            新しいパスワード
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={formData.newPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
              className="w-full px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              minLength={8}
              required
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              aria-pressed={showNew}
              title={showNew ? '非表示にする' : '表示する'}
              className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              {showNew ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.585 10.585A2 2 0 0012 14a2 2 0 001.414-.586" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.88 4.49A9.77 9.77 0 0112 4c7 0 10 8 10 8a13.37 13.37 0 01-3.288 4.793M6.228 6.228A13.377 13.377 0 002 12s3 8 10 8a9.77 9.77 0 002.12-.26" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
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
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              className="w-full px-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              aria-pressed={showConfirm}
              title={showConfirm ? '非表示にする' : '表示する'}
              className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            >
              {showConfirm ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.585 10.585A2 2 0 0012 14a2 2 0 001.414-.586" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9.88 4.49A9.77 9.77 0 0112 4c7 0 10 8 10 8a13.37 13.37 0 01-3.288 4.793M6.228 6.228A13.377 13.377 0 002 12s3 8 10 8a9.77 9.77 0 002.12-.26" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !validatePassword(formData.newPassword).isValid}
          className="w-full px-4 py-3 sm:py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed tap-target font-medium"
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
