import type { AuthOptions } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GithubProvider from "next-auth/providers/github"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? [
      GithubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        // OAuth削除時の再認証を強制
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code"
          }
        }
      })
    ] : []),
    
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        // OAuth削除時の再認証を強制
        authorization: {
          params: {
            prompt: "consent",
            access_type: "offline",
            response_type: "code"
          }
        }
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
            hasPassword: true, // パスワード認証フラグ
          }
        } catch (error) {
          console.error('認証エラー:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user && token.sub) {
        session.user.id = token.sub
        session.user.hasPassword = token.hasPassword || false
      }
      return session
    },
    jwt: async ({ user, token, account }) => {
      if (user) {
        token.sub = user.id
        // OAuth認証かパスワード認証かを判定
        if (account?.provider === 'credentials') {
          token.hasPassword = true
        } else {
          // OAuth認証の場合、DBでパスワードの有無を確認
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: user.id },
              select: { password: true }
            })
            token.hasPassword = !!dbUser?.password
          } catch (error) {
            token.hasPassword = false
          }
        }
      }
      return token
    },
    // OAuth削除後の適切なリダイレクト
    redirect: async ({ url, baseUrl }) => {
      // OAuth削除後のリダイレクト先を制御
      if (url.includes('/auth/oauth-removed')) {
        return `${baseUrl}/auth/oauth-removed`
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    // サインイン時の追加検証
    signIn: async ({ user, account, profile }) => {
      // OAuth認証の場合、削除されたアカウントでないかチェック
      if (account?.provider && account.provider !== 'credentials') {
        try {
          const existingAccount = await prisma.account.findFirst({
            where: {
              provider: account.provider,
              providerAccountId: account.providerAccountId
            }
          })
          
          // 削除されたOAuthアカウントの場合は認証を拒否
          if (!existingAccount) {
            console.log(`OAuth account not found: ${account.provider}:${account.providerAccountId}`)
            return false
          }
        } catch (error) {
          console.error('SignIn callback error:', error)
          return false
        }
      }
      
      return true
    }
  },
  events: {
    // OAuth連携削除時のログ記録
    signOut: async ({ token }) => {
      console.log(`User signed out: ${token?.sub}`)
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30日
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  debug: process.env.NODE_ENV === 'development',
}