import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Docker最適化
  output: 'standalone',
  
  // サーバー外部パッケージ（Next.js 15の新しい設定）
  serverExternalPackages: ['@prisma/client'],
  
  // 画像最適化（外部ホスト許可）
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Webpack設定でPrismaを最適化
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('@prisma/client')
    }
    return config
  },
}

export default nextConfig