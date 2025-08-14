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
            id: profile.sub, // 一時的にOAuth IDを使用、signIn callbackで実際のDB IDに変更
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
          console.log('🔍 認証処理開始...')
          
          // Lambda API URLが設定されているかチェック
          if (!process.env.LAMBDA_API_URL) {
            console.log('⚠️ LAMBDA_API_URL が設定されていません - Prisma直接認証を試行')
            
            // Prisma直接認証のフォールバック
            try {
              const bcrypt = await import('bcryptjs')
              const { prisma } = await import('@/lib/prisma')
              
              const user = await prisma.user.findUnique({
                where: { email: credentials.email }
              })
              
              if (!user || !user.password) {
                console.log('❌ ユーザーが見つからないか、パスワードが設定されていません')
                return null
              }
              
              const isValid = await bcrypt.compare(credentials.password, user.password)
              if (!isValid) {
                console.log('❌ パスワードが間違っています')
                return null
              }
              
              console.log('✅ Prisma直接認証成功!')
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                hasPassword: true,
              }
            } catch (prismaError) {
              console.error('❌ Prisma直接認証エラー:', prismaError)
              return null
            }
          }
          
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
          
          console.log('✅ Lambda API認証成功!')
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
        
        // OAuth認証時のユーザー統合処理
        if (account?.provider && account.provider !== 'credentials') {
          console.log(`✅ OAuth認証成功: ${user.email} (${account.provider})`)
          
          // データベース操作の安全な実行
          try {
            // Lambda環境の場合は、dbAdapterを使用してユーザー管理を行う
            if (process.env.USE_LAMBDA_DB === 'true') {
              console.log('🔧 Lambda環境でのOAuth統合処理')
              
              const dbAdapter = await import('@/lib/db-adapter')
              
              // 既存ユーザーをメールアドレスで検索
              const existingUserResult = await dbAdapter.default.getUserByEmail(user.email!)
              
              if (existingUserResult.success && existingUserResult.data) {
                const existingUser = existingUserResult.data
                console.log(`🔗 Lambda: 既存ユーザーを発見、OAuth統合中... ${existingUser.id}`)
                console.log(`🔄 Lambda: OAuth ID "${user.id}" を DB ID "${existingUser.id}" にマッピング`)
                
                // JWTトークンで使用するためにユーザーIDをDB IDに変更
                const originalOAuthId = user.id
                user.id = existingUser.id
                account.userId = existingUser.id
                console.log(`✅ Lambda: ユーザーIDマッピング完了: ${originalOAuthId} → ${existingUser.id}`)
                
                return true
              } else {
                console.log('👤 Lambda: 新規ユーザー作成はLambda経由では制限されています')
                console.log('⚠️ OAuth認証は続行しますが、データベース統合は手動で必要です')
                return true
              }
            }
            
            // 直接Prisma接続が利用可能な場合の処理
            if (process.env.NODE_ENV !== 'production') {
              const { testDatabaseConnection } = await import('@/lib/prisma')
              const isDbAvailable = await testDatabaseConnection()
              
              if (!isDbAvailable) {
                console.log('⚠️ データベース接続不可 - OAuth統合をスキップ')
                return true
              }
            }
            
            const { prisma } = await import('@/lib/prisma')
            
            // 同一メールアドレスの既存ユーザーを検索
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email! },
              include: { accounts: true }
            })
            
            if (existingUser) {
              console.log('🔗 既存ユーザーを発見、OAuth統合中...', existingUser.id)
              console.log(`🔄 OAuth ID "${user.id}" を DB ID "${existingUser.id}" にマッピング`)
              
              // 既存のアカウントにOAuth情報を追加
              const existingAccount = await prisma.account.findFirst({
                where: {
                  userId: existingUser.id,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId
                }
              })
              
              if (!existingAccount) {
                await prisma.account.create({
                  data: {
                    userId: existingUser.id,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                    session_state: account.session_state,
                  }
                })
                console.log('✅ OAuth連携を既存アカウントに追加')
              } else {
                console.log('✅ OAuth連携は既に存在します')
              }
              
              // ユーザー情報を更新（名前や画像が更新されている場合）
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  name: user.name || existingUser.name,
                  image: user.image || existingUser.image,
                }
              })
              
              // 🔑 CRITICAL: JWTトークンで使用するためにユーザーIDをDB IDに変更
              const originalOAuthId = user.id
              user.id = existingUser.id
              console.log(`✅ ユーザーIDマッピング完了: ${originalOAuthId} → ${existingUser.id}`)
              
              // セッションでも使用するため、確実にDBのIDを設定
              account.userId = existingUser.id
              
            } else {
              console.log('👤 新規ユーザー作成中...')
              console.log(`🔄 OAuth ID "${user.id}" で新規ユーザーを作成`)
              
              // 新規ユーザーとアカウントを作成（IDは自動生成されるcuidを使用）
              const newUser = await prisma.user.create({
                data: {
                  // IDは指定せず、Prismaの自動生成cuidを使用
                  email: user.email!,
                  name: user.name,
                  image: user.image,
                  accounts: {
                    create: {
                      type: account.type,
                      provider: account.provider,
                      providerAccountId: account.providerAccountId,
                      access_token: account.access_token,
                      refresh_token: account.refresh_token,
                      expires_at: account.expires_at,
                      token_type: account.token_type,
                      scope: account.scope,
                      id_token: account.id_token,
                      session_state: account.session_state,
                    }
                  }
                }
              })
              
              // 🔑 CRITICAL: OAuth IDをPrismaで生成されたDB IDに変更
              const originalOAuthId = user.id
              user.id = newUser.id
              account.userId = newUser.id
              console.log(`✅ 新規ユーザー作成完了: ${originalOAuthId} → ${newUser.id}`)
            }
            
          } catch (error) {
            console.error('❌ OAuth統合エラー (続行):', error)
            // エラーがあっても認証は続行する
            return true
          }
        }
        return true
      } catch (error: unknown) {
        console.error('🚨 signIn callback エラー:', {
          error: error instanceof Error ? error.message : String(error),
          provider: account?.provider,
          email: user?.email
        })
        // 致命的なエラーでも認証を続行してユーザーがアクセスできるように
        return true
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