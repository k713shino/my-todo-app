'use client'

import { SessionProvider } from 'next-auth/react'

// NextAuth.js セッション管理のラッパーコンポーネント
// アプリケーション全体でセッション情報を提供する
export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={undefined}>
      {children}
    </SessionProvider>
  )
}
