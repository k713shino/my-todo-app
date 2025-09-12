'use client'

import { signOut } from 'next-auth/react'

// ログアウトボタンコンポーネント
// クリック時にユーザーをログアウトしてトップページにリダイレクトする
export default function SignOutButton() {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-red-600 hover:text-red-800 transition-colors"
    >
      ログアウト
    </button>
  )
}