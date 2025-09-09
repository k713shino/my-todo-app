# My Todo App – Next.js + Prisma + Redis + Lambda

フルスタックのTodoアプリケーションです。Next.js(App Router)をベースに、認証/タスク管理/時間計測ダッシュボードを備えています。時間計測・集計は AWS Lambda(API Gateway) を経由し、アプリ側ではプロキシAPIを提供します。Redis はキャッシュや目標/統計の補助に使用します。

## 主な機能
- 🔐 認証(NextAuth)とプロフィール管理
- ✅ Todo管理(優先度/カテゴリ/タグ/サブタスク/期限)
- ⏱ 時間計測(開始/停止)と分析/ランキング/目標(今日/週)
- 🧭 ダッシュボードのタブ切替(タスク/時間) + 右カラムの要約/ライブインジケータ
- 📤 データエクスポート(JSON/CSV) / 保存済み検索 / 検索履歴

## 技術スタック
- Frontend: Next.js 15(App Router), React 19, Tailwind CSS
- API/Server: Next.js Route Handlers(一部 Lambda へプロキシ), Prisma ORM
- DB: PostgreSQL
- Cache/PubSub: Redis(ioredis)
- External: AWS API Gateway + Lambda(時間追跡・集計)

## ディレクトリ
- `app/` … 画面/Route Handlers(API)
- `lib/` … Prisma/Redis/認証/ユーティリティ
- `lambda-js/` … Lambda ハンドラー(index.js)
- `prisma/` … Prisma スキーマ(schema.prisma)
- `docker-compose.yml` … Postgres/Redis/ツール/本番ビルド用app

---

## クイックセットアップ(推奨)
前提: Node.js 18+, Docker(任意), Git

1) 依存関係の導入
```bash
npm i
```

2) 環境変数を設定
```bash
cp .env.example .env.local
# .env.local を編集して必要値を設定
# 例: DATABASE_URL, REDIS_URL, LAMBDA_API_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
```

3) ローカルDB/Redisを起動(任意)
```bash
docker-compose up -d postgres redis
```

4) DBスキーマを反映
```bash
npx prisma db push
```

5) 開発サーバを起動
```bash
npm run dev
# http://localhost:3000
```

補助スクリプト(一括)
```bash
./start-local-dev.sh
# Postgres/Redis の起動 → Prisma db push → dev 起動
```

> 時間計測機能/ダッシュボードは `LAMBDA_API_URL` が必須です。未設定のときはサマリ/分析が簡易表示(0など)になります。

---

## Dockerでまとめて実行(本番ビルド相当)
```bash
docker-compose up -d
# app コンテナが next build → next start(3000) を行います
```

---

## 環境変数(.env.local の例)
```env
# DB
DATABASE_URL=postgresql://todouser:todopass123@localhost:5432/todoapp

# Redis
REDIS_URL=redis://localhost:6379

# Lambda(API Gateway)ベースURL
LAMBDA_API_URL=https://xxxx.execute-api.ap-northeast-1.amazonaws.com/prod

# NextAuth
NEXTAUTH_SECRET=your-super-secret-key
NEXTAUTH_URL=http://localhost:3000

# 任意のタイムアウト調整
LAMBDA_API_TIMEOUT_MS=8000
REDIS_CONNECT_TIMEOUT_MS=7000
REDIS_COMMAND_TIMEOUT_MS=7000
```

---

## よくある質問
- Q. Lambdaを用意しなくても動きますか?
  - A. Todoの表示/作成など基本機能は動きますが、時間サマリ/分析などはフォールバック(0や簡易表示)になります。
- Q. Redisは必須ですか?
  - A. なくても最低限は動作します(モックへフェイルオーバー)。ただしキャッシュ/統計/UIの一部が劣化します。
- Q. Prismaは何をしていますか?
  - A. スキーマ管理と型安全なDBアクセスの基盤で、`lib/prisma.ts` にLambda環境向けの最適化が入っています。

---

## スクリプト
- `npm run dev` … 開発サーバ
- `npm run build && npm start` … 本番起動
- `npm run type-check` … TypeScriptチェック
- `npx prisma db push` … スキーマ反映

---

## トラブルシューティング
- 右カラムの時間インジケータが出ない/0のまま:
  - `LAMBDA_API_URL` の設定/疎通をご確認ください。
- Redis接続エラーが続く:
  - `REDIS_URL` が正しいか、ポート(6379)の競合がないか確認。接続不可時は自動的にモックへ切替(ログ参照)。
- Dockerのポート競合:
  - 3000, 5432, 6379, 5050(pgAdmin), 8081(Redis Commander) の使用状況を確認。

---

## スクリーンショット
ダークモードのみ掲載
![Tasks](docs/screenshots/dashboard-tasks.png)
タスクモード
![Time](docs/screenshots/dashboard-time.png)
時間モード
![Signin](docs/screenshots/auth-signin.png)
サインイン画面

---

## ライセンス
私用/検証目的
