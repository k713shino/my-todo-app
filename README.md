# Todo管理システム

現代的な技術スタックで構築された個人用Todoリストアプリケーション

## 機能概要

- 🔐 **セキュアな認証**: GitHub OAuth による安全なログイン
- 📊 **優先度管理**: 4段階の優先度設定
- 📅 **期限管理**: 日時指定とアラート機能
- 🔍 **検索・フィルター**: 効率的なタスク検索
- 📱 **レスポンシブデザイン**: 全デバイス対応
- ⚡ **リアルタイム更新**: 即座にデータ反映
- 🐳 **Docker対応**: 統一された開発環境

## 技術仕様

- **フロントエンド**: Next.js 15 + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: PostgreSQL + Prisma ORM
- **認証**: NextAuth.js + GitHub OAuth
- **コンテナ化**: Docker + Docker Compose
- **デプロイ**: Vercel

## セットアップ手順

### 前提条件

- Windows 10/11 + WSL2
- Docker Desktop
- Node.js 20+
- Git

### インストール

1. **リポジトリクローン**
   ```bash
   git clone https://github.com/yourusername/my-todo-app.git
   cd my-todo-app
   ```

2. **依存関係インストール**
   ```bash
   npm install
   ```

3. **環境変数設定**
   ```bash
   cp .env.example .env.local
   # .env.localを編集して必要な値を設定
   ```

4. **開発環境起動**
   ```bash
   ./start-dev.sh
   ```

5. **ブラウザでアクセス**
   ```
   http://localhost:3000
   ```


## API仕様

- `GET /api/todos` - Todo一覧取得
- `POST /api/todos` - Todo作成
- `PUT /api/todos/[id]` - Todo更新
- `DELETE /api/todos/[id]` - Todo削除
- `GET /api/health` - ヘルスチェック

## データベーススキーマ

```prisma
model User {
  id       String @id @default(cuid())
  name     String?
  email    String @unique
  todos    Todo[]
}

model Todo {
  id          String   @id @default(cuid())
  title       String
  description String?
  completed   Boolean  @default(false)
  priority    Priority @default(MEDIUM)
  dueDate     DateTime?
  user        User     @relation(fields: [userId], references: [id])
  userId      String
}
```

## プロジェクト構造

```
my-todo-app/
├── app/                    # Next.js App Router
│   ├── components/         # UIコンポーネント
│   ├── dashboard/          # ダッシュボードページ
│   ├── auth/               # 認証ページ
│   └── api/                # API Routes
├── prisma/                 # データベーススキーマ
├── lib/                    # ユーティリティ関数
├── types/                  # TypeScript型定義
└── docker-compose.yml      # Docker設定
```

## コントリビューション

1. リポジトリをフォーク
2. 機能ブランチ作成 (`git checkout -b feature/new-feature`)
3. 変更をコミット (`git commit -m 'Add: 新機能追加'`)
4. ブランチをプッシュ (`git push origin feature/new-feature`)
5. プルリクエスト作成

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## サポート

ご質問やバグ報告は[Issues](https://github.com/yourusername/my-todo-app/issues)までお願いします。
