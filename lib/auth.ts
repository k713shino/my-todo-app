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
        allowDangerousEmailAccountLinking: true, // メール連携を許可
      })
    ] : []),
    
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true, // メール連携を許可
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
        if (!credentials?.email || !credentials?.password) return null
        
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          })
          
          if (!user || !user.password) return null
          
          const isValid = await bcrypt.compare(credentials.password, user.password)
          
          if (!isValid) return null
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            hasPassword: true,
          }
        } catch (error) {
          console.error('認証エラー:', error)
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
      }
      return session
    },
    jwt: async ({ user, token, account }: { user?: User; token: JWT; account?: any }) => {
      if (user) {
        token.sub = user.id
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
    signIn: async ({ user, account, profile }: { user: User; account: any; profile?: any }) => {
      try {
        // OAuth認証の場合の追加処理
        if (account?.provider && account.provider !== 'credentials') {
          console.log('=== OAuth認証デバッグ情報 ===')
          console.log(`プロバイダー: ${account.provider}`)
          console.log(`メールアドレス: ${user.email}`)
          console.log(`アカウント情報:`, account)
          console.log(`プロフィール情報:`, profile)
          
          // メールアドレスが既存ユーザーと重複している場合の処理
          if (user.email) {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email }
            })
            
            if (existingUser) {
              console.log(`既存ユーザーとのアカウント連携: ${user.email}`)
              console.log(`既存ユーザー情報:`, existingUser)
            }
          }
        }
        
        return true
      } catch (error) {
        console.error('=== 認証エラー ===')
        console.error('エラー詳細:', error)
        console.error('認証情報:', { user, account, profile })
        return true // エラーでもサインインを継続
      }
    }
  },
  events: {
    signOut: async ({ token }: { token: JWT }) => {
      console.log('=== サインアウト ===')
      console.log(`ユーザーID: ${token?.sub}`)
      console.log('トークン情報:', token)
    },
    signIn: async ({ user, account }: { user: User; account: any }) => {
      console.log('=== サインイン成功 ===')
      console.log(`ユーザー: ${user.email}`)
      console.log(`認証方法: ${account?.provider}`)
      console.log('アカウント詳細:', account)
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/signin", // エラー時もサインインページにリダイレクト
  },
  debug: process.env.NODE_ENV === 'development',
  // 本番環境でのクッキー設定を簡素化
  ...(process.env.NODE_ENV === 'production' && {
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