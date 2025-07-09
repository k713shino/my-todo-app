#!/bin/bash

echo "🚀 開発環境を起動中..."

# 環境変数ファイルの確認
if [ ! -f .env.local ]; then
    echo "❌ .env.localファイルが見つかりません"
    echo "📝 .env.localを作成してください"
    exit 1
fi

# AWS RDS接続確認
echo "☁️ AWS RDS PostgreSQL接続確認中..."
npx prisma db push --accept-data-loss

if [ $? -eq 0 ]; then
    echo "✅ AWS RDS PostgreSQL接続成功"
else
    echo "❌ AWS RDS PostgreSQL接続失敗"
    echo "📝 DATABASE_URLを確認してください"
    exit 1
fi

# 開発サーバー起動
echo "🌟 開発サーバーを起動..."
npm run dev