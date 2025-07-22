import type { AuthOptions, Session, User } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"  // 🔥 修正: 正しいパッケージ
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"
import type { JWT } from "next-auth/jwt"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
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
          console.log('🔍 データベースでユーザー検索中...')
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              image: true
            }
          })
          
          console.log('👤 ユーザー検索結果:', {
            found: !!user,
            email: user?.email,
            hasPassword: !!user?.password,
            passwordHash: user?.password ? `${user.password.substring(0, 10)}...` : 'none'
          })
          
          if (!user) {
            console.log('❌ 認証失敗: ユーザーが見つかりません')
            // より詳細なエラー情報を返すためにthrowを使用
            throw new Error('USER_NOT_FOUND')
          }
          
          if (!user.password) {
            console.log('❌ 認証失敗: パスワードが設定されていません（OAuth認証ユーザー）')
            throw new Error('OAUTH_USER_NO_PASSWORD')
          }
          
          console.log('🔐 パスワード検証中...')
          const isValid = await bcrypt.compare(credentials.password, user.password)
          console.log('🔐 パスワード検証結果:', isValid)
          
          if (!isValid) {
            console.log('❌ 認証失敗: パスワードが一致しません')
            throw new Error('INVALID_PASSWORD')
          }
          
          console.log('✅ 認証成功!')
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            hasPassword: true,
          }
        } catch (error) {
          console.error('🚨 認証エラー:', error)
          console.error('エラー詳細:', {
            message: error.message,
            stack: error.stack
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
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { password: true }
            })
            token.hasPassword = !!dbUser?.password
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
        
        // OAuth認証時の基本ログ
        if (account?.provider && account.provider !== 'credentials') {
          console.log(`✅ OAuth認証成功: ${user.email} (${account.provider})`)
          
          // GitHub/Googleの設定チェック
          if (account.provider === 'github') {
            console.log('GitHub設定確認:', {
              clientId: !!process.env.GITHUB_CLIENT_ID,
              clientSecret: !!process.env.GITHUB_CLIENT_SECRET,
              nextauthUrl: process.env.NEXTAUTH_URL
            })
          }
          
          if (account.provider === 'google') {
            console.log('Google設定確認:', {
              clientId: !!process.env.GOOGLE_CLIENT_ID,
              clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
              nextauthUrl: process.env.NEXTAUTH_URL
            })
          }
        }
        return true
      } catch (error) {
        console.error('🚨 signIn callback エラー:', {
          error: error.message,
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