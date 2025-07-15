import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      hasPassword?: boolean // パスワード認証かどうか
    }
  }

  interface User {
    id: string
    name?: string | null
    email?: string | null
    image?: string | null
    hasPassword?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string
    id?: string
    hasPassword?: boolean
  }
}