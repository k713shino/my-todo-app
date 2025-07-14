# マルチステージビルドで最適化
FROM node:20-alpine AS base

# 依存関係のインストール
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# package.jsonとlock fileをコピー
COPY package.json package-lock.json* ./
# prismaディレクトリもコピー（postinstallでprisma generateが必要なため）
COPY prisma ./prisma

RUN npm ci

# ビルダーステージ
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# 全てのソースファイルをコピー
COPY . .

# 🔴 ビルド時環境変数の設定
ENV NEXT_TELEMETRY_DISABLED=1
# Prismaビルド用のダミーDATABASE_URL（実際の接続は実行時に行う）
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
ENV NEXTAUTH_SECRET="dummy-secret-for-build"
ENV NEXTAUTH_URL="http://localhost:3000"

# Prismaクライアント生成（明示的に実行）
RUN npx prisma generate

# Next.jsアプリケーションビルド
RUN npm run build

# ランナーステージ
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Next.js standalone出力を使用
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma関連ファイル
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]