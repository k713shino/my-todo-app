import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth'
import type { Session } from 'next-auth'

// 型安全なセッション取得関数
export async function getAuthSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions)
  return session
}

// セッション型ガード
export function isAuthenticated(session: Session | null): session is Session & {
  user: {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
} {
  return session?.user?.id != null
}

// API用のセッション検証
export async function requireAuth() {
  const session = await getAuthSession()
  
  if (!isAuthenticated(session)) {
    throw new Error('Unauthorized')
  }
  
  return session
}