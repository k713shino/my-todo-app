#!/bin/bash

echo "🚀 開発環境を起動中..."

# 環境変数ファイルの確認
if [ ! -f .env.local ]; then
    echo "❌ .env.localファイルが見つかりません"
    echo "📝 .env.localを作成してください"
    exit 1
fi

# Dockerコンテナ起動
echo "🐳 PostgreSQLコンテナを起動..."
docker-compose up -d postgres

# データベースの接続待機
echo "⏳ データベースの起動を待機中..."
sleep 10

# Prismaマイグレーション
echo "🔄 データベースマイグレーション実行..."
npx prisma db push

# 開発サーバー起動
echo "🌟 開発サーバーを起動..."
npm run dev