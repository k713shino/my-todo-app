#!/bin/bash

# ローカル開発環境セットアップスクリプト

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Todoアプリ開発環境セットアップです ✨"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Redis起動確認
echo ""
echo "🔴 1. Redis の状況を確認いたします..."
if docker ps | grep -q "todo-redis"; then
    echo "✅ Redis: 既に起動済みです"
else
    echo "🚀 Redis を起動中..."
    docker-compose up -d redis
    sleep 3
    
    if docker ps | grep -q "todo-redis"; then
        echo "✅ Redis: 起動完了です"
    else
        echo "⚠️  Redis起動に失敗。モック機能で継続します"
    fi
fi

# PostgreSQL起動確認
echo ""
echo "🗄️ 2. PostgreSQL の状況を確認します..."
if docker ps | grep -q "todo-postgres"; then
    echo "✅ PostgreSQL: 既に起動済みです"
else
    echo "🚀 PostgreSQL を起動中..."
    docker-compose up -d postgres
    sleep 5
    
    if docker ps | grep -q "todo-postgres"; then
        echo "✅ PostgreSQL: 起動完了です"
    else
        echo "❌ PostgreSQL起動に失敗しました"
        exit 1
    fi
fi

# データベーススキーマ同期
echo ""
echo "🔧 3. データベーススキーマを同期中..."
npx prisma db push

# 開発サーバー起動
echo ""
echo "🌟 4. 開発サーバーを起動します..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ http://localhost:3000 でTodoライフを ✨"  
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

npm run dev