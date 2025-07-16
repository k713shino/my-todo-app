import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1時間に5回まで）
    const rateLimitResult = await RateLimiter.checkRateLimit(
      `revoke_oauth:${session.user.id}`, 
      3600, 
      5
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'OAuth削除の試行回数が上限に達しました。1時間後に再試行してください。' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { provider } = body // 'github' または 'google'

    if (!provider || !['github', 'google'].includes(provider)) {
      return NextResponse.json(
        { error: '無効なプロバイダーです。' }, 
        { status: 400 }
      )
    }

    // 該当するOAuthアカウントを取得
    const oauthAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: provider
      }
    })

    if (!oauthAccount) {
      return NextResponse.json(
        { error: `${provider}アカウントの連携が見つかりません。` }, 
        { status: 404 }
      )
    }

    // ユーザーの他の認証方法をチェック
    const userWithAccounts = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: true
      }
    })

    if (!userWithAccounts) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません。' }, 
        { status: 404 }
      )
    }

    // 削除後に認証方法が残るかチェック
    const otherOAuthAccounts = userWithAccounts.accounts.filter(
      account => account.provider !== provider
    )
    const hasPassword = !!userWithAccounts.password

    if (otherOAuthAccounts.length === 0 && !hasPassword) {
      return NextResponse.json(
        { 
          error: 'この認証方法を削除すると、アカウントにアクセスできなくなります。先にパスワードを設定するか、他のOAuth認証を追加してください。' 
        }, 
        { status: 400 }
      )
    }

    // OAuth外部サービスでのアクセス取り消し（オプション）
    try {
      if (oauthAccount.access_token) {
        await revokeOAuthToken(provider, oauthAccount.access_token)
      }
    } catch (error) {
      console.warn(`OAuth token revocation failed for ${provider}:`, error)
      // 外部サービスでの取り消しに失敗してもDB削除は続行
    }

    // OAuthアカウント削除
    await prisma.account.delete({
      where: { id: oauthAccount.id }
    })

    // 関連するセッションも削除（安全のため）
    await prisma.session.deleteMany({
      where: { userId: session.user.id }
    })

    console.log(`✅ OAuth account removed: ${provider} for user ${session.user.id}`)

    return NextResponse.json({ 
      message: `${provider}認証の連携が正常に削除されました。`,
      removedProvider: provider,
      remainingProviders: otherOAuthAccounts.map(acc => acc.provider),
      hasPassword
    })

  } catch (error) {
    console.error('OAuth revocation error:', error)
    return NextResponse.json(
      { error: 'OAuth連携の削除に失敗しました。' }, 
      { status: 500 }
    )
  }
}

// OAuth外部サービスでのトークン無効化
async function revokeOAuthToken(provider: string, accessToken: string): Promise<void> {
  switch (provider) {
    case 'github':
      // GitHub OAuth App のトークン無効化
      const githubClientId = process.env.GITHUB_CLIENT_ID
      const githubClientSecret = process.env.GITHUB_CLIENT_SECRET
      
      if (githubClientId && githubClientSecret) {
        const response = await fetch(`https://api.github.com/applications/${githubClientId}/token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${githubClientId}:${githubClientSecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({ access_token: accessToken })
        })
        
        if (!response.ok) {
          throw new Error(`GitHub token revocation failed: ${response.status}`)
        }
      }
      break

    case 'google':
      // Google OAuth のトークン無効化
      const revokeResponse = await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
      
      if (!revokeResponse.ok) {
        throw new Error(`Google token revocation failed: ${revokeResponse.status}`)
      }
      break

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// OPTIONS メソッドの追加（CORS対応）
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}