'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

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

  // パスワード強度チェック
  const getPasswordStrength = (password: string) => {
    let strength = 0
    if (password.length >= 8) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/\d/.test(password)) strength++
    if (/[@$!%*?&]/.test(password)) strength++
    
    const levels = ['とても弱い', '弱い', '普通', '強い', 'とても強い']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']
    
    return { level: levels[strength] || '弱い', color: colors[strength] || 'bg-red-500', score: strength }
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

    const passwordStrength = getPasswordStrength(formData.newPassword)
    if (passwordStrength.score < 3) {
      toast.error('パスワードが弱すぎます。より強力なパスワードを使用してください')
      return
    }

    setIsLoading(true)
    
    try {
      console.log('パスワード変更APIを呼び出します')
      const response = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        })
      })
      
      const data = await response.json()
      console.log('APIレスポンスを受信:', { status: response.status, ok: response.ok })
      
      if (response.ok) {
        toast.success('パスワードが正常に変更されました')
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        if (data.failedRequirements) {
          toast.error(data.error, { duration: 5000 })
        } else {
          toast.error(data.error || 'パスワード変更に失敗しました')
        }
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

  const passwordStrength = getPasswordStrength(formData.newPassword)

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
          {formData.newPassword && (
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{passwordStrength.level}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                8文字以上、大文字・小文字・数字・特殊文字を含むパスワードを推奨
              </p>
            </div>
          )}
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