import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

// NextAuth v4のデフォルトエクスポート使用
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }