import type { AuthOptions, Session, User } from "next-auth"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"

export const authOptions: AuthOptions = {
  // Lambda API経由でユーザー管理するため、adapterは使用しない
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [
      GithubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            scope: "read:user user:email"
          }
        },
        profile(profile) {
          return {
            id: profile.id.toString(),
            name: profile.name || profile.login,
            email: profile.email,
            image: profile.avatar_url,
          }
        },
      })
    ] : []),
    
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
        authorization: {
          params: {
            scope: "openid email profile"
          }
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
          }
        },
      })
    ] : []),
    
    // メールアドレス + パスワード認証
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" }
      },
      async authorize(credentials) {
        console.log('🔍 === 認証開始 ===')
        console.log('リクエスト情報:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
          passwordLength: credentials?.password?.length
        })

        if (!credentials?.email || !credentials?.password) {
          console.log('❌ 認証失敗: メールまたはパスワードが未入力')
          return null
        }
        
        try {
          console.log('🔍 Lambda API経由でユーザー検索中...')
          
          // Lambda API経由でユーザー認証
          const response = await fetch(`${process.env.LAMBDA_API_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          })
          
          if (!response.ok) {
            console.log('❌ Lambda API認証失敗:', response.status)
            return null
          }
          
          const data = await response.json()
          const user = data.user
          
          console.log('👤 Lambda API認証結果:', {
            success: data.success,
            found: !!user,
            email: user?.email
          })
          
          if (!data.success || !user) {
            console.log('❌ 認証失敗:', data.error || 'ユーザーが見つかりません')
            throw new Error(data.error || 'USER_NOT_FOUND')
          }
          
          console.log('✅ 認証成功!')
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            hasPassword: true,
          }
        } catch (error: unknown) {
          console.error('🚨 認証エラー:', error)
          console.error('エラー詳細:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          })
          return null
        }
      }
    })
  ],
  callbacks: {
    session: async ({ session, token }: { session: Session; token: JWT }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub
        session.user.hasPassword = token.hasPassword || false
        session.user.image = token.picture || null
      }
      return session
    },
    jwt: async ({ user, token, account }: { user?: User; token: JWT; account?: any }) => {
      console.log('JWT更新前:', {
        tokenPicture: token.picture,
        userImage: user?.image
      })

      if (user) {
        token.sub = user.id
        token.picture = user.image
        if (account?.provider === 'credentials') {
          token.hasPassword = true
        } else {
          // OAuth認証の場合、Lambda API経由でパスワード状態を確認
          try {
            const response = await fetch(`${process.env.LAMBDA_API_URL}/auth/user/${user.id}`)
            if (response.ok) {
              const userData = await response.json()
              token.hasPassword = !!userData.user?.password
            } else {
              token.hasPassword = false
            }
          } catch (_error) {
            token.hasPassword = false
          }
        }
      }
      return token
    },
    redirect: async ({ url, baseUrl }: { url: string; baseUrl: string }) => {
      // 相対URLの場合はbaseUrlを前に付ける
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // 同じオリジンの場合はそのまま返す
      else if (new URL(url).origin === baseUrl) return url
      // それ以外はダッシュボードにリダイレクト
      return `${baseUrl}/dashboard`
    },
    signIn: async ({ user, account }: { user: User; account: any }) => {
      try {
        console.log('🔐 signIn callback 実行中', {
          provider: account?.provider,
          email: user?.email,
          userId: user?.id,
          accountId: account?.providerAccountId
        })
        
        // OAuth認証時のユーザー作成・更新をLambda API経由で実行
        if (account?.provider && account.provider !== 'credentials') {
          console.log(`✅ OAuth認証成功: ${user.email} (${account.provider})`)
          
          // Lambda API経由でOAuthユーザーを作成・更新
          try {
            const response = await fetch(`${process.env.LAMBDA_API_URL}/auth/oauth-user`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  image: user.image,
                },
                account: {
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                }
              })
            })
            
            if (!response.ok) {
              console.error('Lambda API OAuth用户作成失敗:', response.status)
            } else {
              console.log('Lambda API OAuth用户作成成功')
            }
          } catch (error) {
            console.error('Lambda API OAuth用户作成エラー:', error)
          }
        }
        return true
      } catch (error: unknown) {
        console.error('🚨 signIn callback エラー:', {
          error: error instanceof Error ? error.message : String(error),
          provider: account?.provider,
          email: user?.email
        })
        return false // 認証を停止
      }
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin",
  },
  debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === 'true',
  // 本番環境でのセキュリティ設定
  ...(process.env.NODE_ENV === 'production' && process.env.NEXTAUTH_URL?.startsWith('https://') && {
    useSecureCookies: true,
    cookies: {
      sessionToken: {
        name: '__Secure-next-auth.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        }
      }
    }
  })
}