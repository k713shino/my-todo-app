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
- 🚀 **キャッシュ処理**: Redisによる高速なデータアクセス

## 技術仕様

- **フロントエンド**: Next.js 15 + TypeScript + Tailwind CSS
- **バックエンド**: Next.js API Routes
- **データベース**: PostgreSQL + Prisma ORM
- **キャッシュ/セッション管理**: Redis
- **認証**: NextAuth.js + GitHub OAuth
- **コンテナ化**: Docker + Docker Compose
- **デプロイ**: Vercel

## セットアップ手順

### 前提条件

- Windows 10/11 + WSL2
- Docker Desktop
- Node.js 20+
- Redis（Docker経由で起動可）
- Git

### インストール

1. **リポジトリクローン**
   ```bash
   git clone https://github.com/k713shino/my-todo-app.git
   cd my-todo-app
   ```

2. **依存関係インストール**
   ```bash
   npm install
   ```

3. **Redisのセットアップ**
   - Docker経由でRedisを起動する場合:
     ```bash
     docker run --name my-redis -p 6379:6379 -d redis
     ```

4. **環境変数設定**
   ```bash
   cp .env.example .env.local
   # .env.localを編集して必要な値を設定
   ```
   Redis関連の環境変数例:
   ```
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

5. **開発環境起動**
   ```bash
   ./start-dev.sh
   ```

6. **ブラウザでアクセス**
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
}
```

## Redisの利用例

- セッション管理やタスク一覧のキャッシュ処理にRedisを活用しています。
- Redisの設定は`.env.local`で行い、必要に応じて`REDIS_HOST`や`REDIS_PORT`を変更してください。

---

何か追加情報やご要望があればご連絡ください！
