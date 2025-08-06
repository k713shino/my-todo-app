/** @type {import('next').NextConfig} */
const nextConfig = {
  // TypeScript設定
  typescript: {
    // 本番ビルド時でも型エラーを厳密にチェック
    ignoreBuildErrors: false,
  },
  
  // ESLint設定
  eslint: {
    // 本番ビルド時のESLintエラーも厳密にチェック
    ignoreDuringBuilds: false,
  },

  // 環境変数の設定
  env: {
    LAMBDA_API_URL: process.env.LAMBDA_API_URL,
  },

  // 外部APIへのアクセス許可
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },

  // API Routes設定
  async rewrites() {
    return [
      // Lambda APIへのプロキシ（開発時用）
      {
        source: '/api/lambda-proxy/:path*',
        destination: `${process.env.LAMBDA_API_URL || 'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod'}/:path*`,
      },
    ];
  },

  // 画像最適化設定
  images: {
    domains: [
      'wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com',
    ],
  },

  // 実験的機能
  experimental: {
    // App Routerは標準サポートになったため削除
  },

  // CSS最適化設定
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 本番環境でのCSS最適化
  productionBrowserSourceMaps: false,

  // 静的最適化の設定
  staticPageGenerationTimeout: 180,
};

module.exports = nextConfig;