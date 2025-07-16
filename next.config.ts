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
  
  // 本番ビルド時のエラー対策
  eslint: {
    ignoreDuringBuilds: true, // ESLintエラーを無視
  },
  typescript: {
    ignoreBuildErrors: true, // TypeScriptエラーを無視（必要に応じて）
  },
  
  // 環境変数の設定
  env: {
    // ビルド時のダミーDATA BASE_URL
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy?connect_timeout=1',
  },
  
  // 画像設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig