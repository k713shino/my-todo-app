# マルチステージビルドで最適化
FROM node:20-alpine3.20 AS base

# ベースパッケージのセキュリティアップデートを適用（脆弱性軽減）
RUN apk --no-cache update && apk --no-cache upgrade

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

# Prismaクライアント生成（必要なときのみ一時的に環境変数を付与）
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Next.jsアプリケーションビルド（必要に応じてダミーURLを一時的に付与）
RUN NEXTAUTH_URL="http://localhost:3000" npm run build

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

# ヘルスチェック（curl不要・Nodeのfetchで実施）
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
