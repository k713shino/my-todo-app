import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ユーザーのOAuthアカウント一覧を取得
    const oauthAccounts = await prisma.account.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        provider: true,
        providerAccountId: true
      },
      orderBy: {
        provider: 'asc'
      }
    })

    // ユーザーのパスワード認証情報も取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        password: true
      }
    })

    return NextResponse.json({
      accounts: oauthAccounts,
      hasPassword: !!user?.password,
      totalAccounts: oauthAccounts.length
    })

  } catch (error) {
    console.error('OAuth accounts fetch error:', error)
    return NextResponse.json(
      { error: 'OAuth連携情報の取得に失敗しました' }, 
      { status: 500 }
    )
  }
}