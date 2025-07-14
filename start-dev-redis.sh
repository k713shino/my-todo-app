#!/bin/bash

# 🎀 Vercel デプロイメント実行スクリプト
# 壱百満天原サロメ特製～優雅なデプロイライフを♪

echo "🎀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Redis統合Todoアプリケーション Vercelデプロイ開始ですわ ✨"
echo "🎀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ステップ1: 前提条件チェック
echo ""
echo "🔍 1. 前提条件をチェック中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Git確認
if command -v git &> /dev/null; then
    echo "✅ Git: インストール済み"
else
    echo "❌ Git: インストールが必要ですわ"
    exit 1
fi

# Node.js確認
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js: インストールが必要ですわ"
    exit 1
fi

# npm確認
if command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ npm: インストールが必要ですわ"
    exit 1
fi

# ステップ2: Vercel CLI インストール
echo ""
echo "📦 2. Vercel CLIをインストール中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm install -g vercel

# ステップ3: プロジェクト準備
echo ""
echo "🎨 3. プロジェクトを準備中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 依存関係インストール
echo "📚 依存関係をインストール..."
npm install

# ビルドテスト
echo "🔨 ビルドテストを実行..."
npm run build || {
    echo "❌ ビルドに失敗いたしましたわ"
    echo "💡 環境変数をチェックしてくださいませ"
    exit 1
}

echo "✅ ビルド成功ですわ！"

# ステップ4: Git設定
echo ""
echo "📝 4. Gitリポジトリを設定中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Git初期化（未初期化の場合）
if [ ! -d ".git" ]; then
    echo "🎯 Gitリポジトリを初期化..."
    git init
    git add .
    git commit -m "🎀 Initial commit - Redis統合Todoアプリ完成版"
fi

# リモートリポジトリ確認
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE_URL" ]; then
    echo "⚠️  GitHubリポジトリのURLを設定してくださいませ"
    echo "例: git remote add origin https://github.com/yourusername/my-todo-app.git"
    read -p "GitHubリポジトリURL: " GITHUB_URL
    git remote add origin "$GITHUB_URL"
fi

# 最新コードをプッシュ
echo "☁️ GitHubにプッシュ中..."
git add .
git commit -m "🎀 Deploy準備完了 - $(date '+%Y-%m-%d %H:%M:%S')" || echo "変更なし"
git push -u origin main || git push origin main

# ステップ5: Vercelログイン
echo ""
echo "🔐 5. Vercelにログイン中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
vercel login

# ステップ6: プロジェクトデプロイ
echo ""
echo "🚀 6. Vercelにデプロイ中ですわ..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 初回デプロイ
echo "✨ 初回デプロイを実行..."
vercel

# 本番デプロイ
echo "🌟 本番環境にデプロイ..."
vercel --prod

# ステップ7: 環境変数設定ガイド
echo ""
echo "⚙️ 7. 環境変数設定ガイドですわ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "以下の環境変数をVercelダッシュボードで設定してくださいませ："
echo ""
echo "🔴 必須項目："
echo "  DATABASE_URL=postgresql://user:pass@host:5432/db"
echo "  REDIS_URL=redis://redis-host:6379"
echo "  NEXTAUTH_SECRET=your-32-character-secret-key"
echo "  NEXTAUTH_URL=https://your-app.vercel.app"
echo ""
echo "🔑 OAuth設定："
echo "  GITHUB_CLIENT_ID=your-github-client-id"
echo "  GITHUB_CLIENT_SECRET=your-github-client-secret"
echo "  GOOGLE_CLIENT_ID=your-google-client-id"
echo "  GOOGLE_CLIENT_SECRET=your-google-client-secret"
echo ""
echo "💡 環境変数は Vercel Dashboard → Settings → Environment Variables で設定"

# ステップ8: データベース同期
echo ""
echo "🗄️ 8. データベース同期の案内ですわ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "本番データベースにスキーマを同期してくださいませ："
echo ""
echo "DATABASE_URL=\"your-production-url\" npx prisma db push"

# ステップ9: 最終確認
echo ""
echo "🎀 9. デプロイ完了確認ですわ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# プロジェクト情報取得
PROJECT_URL=$(vercel ls 2>/dev/null | grep "my-todo-app" | head -1 | awk '{print $2}' || echo "不明")

echo "✨ デプロイが完了いたしましたわ！"
echo ""
echo "🌐 アプリケーションURL: https://${PROJECT_URL}"
echo "📊 Vercelダッシュボード: https://vercel.com/dashboard"
echo ""
echo "🎭 確認事項："
echo "  □ アプリケーションが正常に表示される"
echo "  □ GitHub認証でログイン可能"
echo "  □ Google認証でログイン可能"
echo "  □ Todo作成・編集・削除が動作"
echo "  □ リアルタイム更新が機能"
echo ""
echo "🎀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ 優雅なデプロイライフをお楽しみくださいませ～♪ ✨"
echo "🎀 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"