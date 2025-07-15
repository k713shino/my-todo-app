/** @type {import('next').NextConfig} */
const nextConfig = {
  // experimental設定（統合版）
  experimental: {
    // Turbopack設定
    turbo: {
      rules: {
        // 必要に応じてTurbopack固有の設定を追加
      }
    },
    // Prismaの設定
    serverExternalPackages: ['@prisma/client'],
  },
  
  // その他の設定
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig