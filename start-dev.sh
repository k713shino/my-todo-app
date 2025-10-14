#!/bin/bash

echo "🚀 ローカル開発環境を起動中..."
echo ""

# 環境変数ファイルの確認
if [ ! -f .env.local ]; then
    echo "❌ .env.localファイルが見つかりません"
    echo "📝 .env.exampleをコピーして.env.localを作成してください:"
    echo "   cp .env.example .env.local"
    exit 1
fi

echo "📋 環境変数ファイル: .env.local を使用"
echo ""

# Dockerサービスの起動確認
echo "🐳 Docker サービスを確認中..."
if ! command -v docker &> /dev/null; then
    echo "⚠️  Dockerがインストールされていません"
    echo "   PostgreSQLとRedisが別途起動していることを確認してください"
else
    # Docker Composeでサービスを起動
    echo "🔧 PostgreSQL と Redis を起動中..."
    docker-compose up -d postgres redis

    if [ $? -eq 0 ]; then
        echo "✅ PostgreSQL と Redis が起動しました"
        echo ""

        # DB接続待機（ヘルスチェックを使用）
        echo "⏳ PostgreSQL の起動を待機中..."
        for i in {1..30}; do
            if docker-compose exec -T postgres pg_isready -U todouser -d todoapp > /dev/null 2>&1; then
                echo "✅ PostgreSQL の起動完了"
                break
            fi
            if [ $i -eq 30 ]; then
                echo "⚠️  PostgreSQL の起動タイムアウト（起動には成功しているかもしれません）"
            fi
            sleep 1
        done
    else
        echo "⚠️  Docker サービスの起動に失敗しました"
        echo "   手動でPostgreSQLとRedisを起動してください"
    fi
fi

echo ""

# データベース接続確認とスキーマ反映
echo "🗄️  データベース接続確認とスキーマ反映中..."
npx prisma db push

if [ $? -eq 0 ]; then
    echo "✅ データベース接続成功・スキーマ反映完了"
else
    echo "❌ データベース接続失敗"
    echo "📝 以下を確認してください:"
    echo "   - PostgreSQLが起動しているか (docker ps で確認)"
    echo "   - .env.localのDATABASE_URLが正しいか"
    echo "   - ポート5432が使用可能か"
    echo ""
    echo "💡 手動で確認するコマンド:"
    echo "   docker ps | grep postgres"
    echo "   docker logs todo-postgres"
    exit 1
fi

echo ""

# 開発サーバー起動
echo "🌟 Next.js 開発サーバーを起動..."
echo "📍 http://localhost:3000 でアクセスできます"
echo ""
echo "ℹ️  停止する場合は Ctrl+C を押してください"
echo ""

npm run dev
