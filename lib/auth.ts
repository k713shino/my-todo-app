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
      })
    ] : []),
    
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
    redirect: async ({ url, baseUrl }) => {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
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