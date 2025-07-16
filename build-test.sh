#!/bin/bash
# build-test.sh - ローカルでビルドをテストするスクリプト

echo "🔧 ビルドテストを開始します..."

# 環境変数を設定
export DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?connect_timeout=1"
export NEXTAUTH_SECRET="dummy-secret-for-build"
export NEXTAUTH_URL="http://localhost:3000"
export SKIP_ENV_VALIDATION="1"
export NEXT_TELEMETRY_DISABLED="1"

echo "📦 依存関係をインストール中..."
npm install

echo "🔨 Prismaクライアントを生成中..."
npx prisma generate

echo "🏗️ Next.jsビルドを開始..."
npm run build:safe

if [ $? -eq 0 ]; then
    echo "✅ ビルドが成功しました！"
    echo "🚀 以下のコマンドでデプロイ可能です："
    echo "   vercel --prod"
else
    echo "❌ ビルドに失敗しました"
    echo "📋 エラーログを確認してください"
    exit 1
fi