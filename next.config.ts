/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker最適化
  output: 'standalone',
  
  // 実験的機能
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  
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
}

module.exports = nextConfig
