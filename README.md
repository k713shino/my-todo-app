# My Todo App – フルスタックTodoアプリケーション

Next.js(App Router) + AWS Lambda をベースに、**認証・タスク管理・時間計測**機能を備えたフルスタックアプリケーションです。

> **💡 アーキテクチャ**: このアプリは時間計測機能にAWS Lambda + API Gatewayを使用します。スケーラビリティとパフォーマンスを最大化するための設計です。

![my-todo-app](docs/screenshots/my-todo-app.png)

## 📋 目次

- [機能紹介](#-機能紹介)
- [技術スタック](#-技術スタック)
- [前提条件](#-前提条件)
- [クイックスタート（初心者向け）](#-クイックスタート初心者向け)
- [詳細セットアップガイド](#-詳細セットアップガイド)
- [OAuth認証の設定](#-oauth認証の設定)
- [Lambda APIのセットアップ（必須）](#-lambda-apiのセットアップ必須)
- [Lambda関数のセキュリティベストプラクティス](#-lambda関数のセキュリティベストプラクティス)
- [使い方](#-使い方)
- [トラブルシューティング](#-トラブルシューティング)
- [よくある質問](#-よくある質問)
- [開発者向け情報](#-開発者向け情報)

---

## 🎯 機能紹介

### コア機能
- **🔐 ユーザー認証**: メール/パスワード、GitHub OAuth、Google OAuth
- **✅ タスク管理**: 優先度、カテゴリ、タグ、期限の設定
- **⏱️ 時間計測**: タスクごとの作業時間を計測・記録（AWS Lambda）
- **📊 データ分析**: 日次・週次・月次の時間分析とランキング
- **🎯 目標管理**: 今日の目標、週の目標を設定して進捗を可視化
- **📈 タイムライン**: 時間計測の履歴をタイムライン形式で表示
- **🔍 検索機能**: タスクの検索、フィルタリング、保存済み検索
- **📤 データエクスポート**: JSON/CSV形式でのデータ出力
- **🌓 ダークモード**: 目に優しいダークモード対応
- **✨ 選択モード**: 複数タスクを一括操作（削除、ステータス更新）

### オプション機能
- **⚡ リアルタイム同期**: Redisを使用したリアルタイム更新
- **💾 キャッシュ機能**: 高速なデータ取得のためのRedisキャッシュ

---

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---------|------|
| **フロントエンド** | Next.js 15 (App Router), React 19, Tailwind CSS |
| **バックエンド** | Next.js API Routes + AWS Lambda, Prisma ORM |
| **データベース** | PostgreSQL |
| **キャッシュ** | Redis (ioredis) - オプション |
| **認証** | NextAuth.js |
| **時間計測API** | AWS Lambda + API Gateway (必須) |
| **デプロイ** | Vercel / Docker |

---

## 📦 前提条件

このアプリを動かすために必要なもの:

### 必須
- **Node.js 18以上** ([ダウンロード](https://nodejs.org/))
- **npm** (Node.jsに含まれます)
- **PostgreSQL** (以下のいずれか)
  - Docker（推奨・簡単）
  - ローカルインストール
  - クラウド（Vercel Postgres、Neon、AWS RDS等）
- **AWS アカウント** (タスク管理・時間計測に必須) ([無料アカウント作成](https://aws.amazon.com/jp/free/))

### 推奨（より簡単に）
- **Docker Desktop** ([ダウンロード](https://www.docker.com/products/docker-desktop))
- **Git** ([ダウンロード](https://git-scm.com/))

### オプション（追加機能用）
- **Redis** (キャッシュ・リアルタイム同期を使う場合)

---

## 🚀 クイックスタート（初心者向け）

### ステップ 1: コードを取得

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/my-todo-app.git
cd my-todo-app
```

### ステップ 2: パッケージをインストール

```bash
npm install
```

これで必要なライブラリがすべてインストールされます（数分かかります）。

### ステップ 3: 環境変数ファイルを作成

```bash
cp .env.example .env.local
```

`.env.local` ファイルをテキストエディタで開いて、以下の最低限の設定を行います:

```env
# データベース接続（Dockerを使う場合）
DATABASE_URL="postgresql://todouser:todopass123@localhost:5432/todoapp"

# NextAuth認証のための秘密鍵（ランダムな文字列）
NEXTAUTH_SECRET="ランダムな32文字以上の文字列に変更してください"
NEXTAUTH_URL="http://localhost:3000"
```

> **💡 秘密鍵の生成方法:**
> ```bash
> openssl rand -base64 32
> ```
> このコマンドで生成された文字列を `NEXTAUTH_SECRET` に設定してください。

### ステップ 4: データベースを起動（Docker使用）

```bash
# PostgreSQLとRedisを起動
docker-compose up -d postgres redis
```

> **📝 注意**: Dockerを使わない場合は、PostgreSQLを別途インストールして起動してください。

### ステップ 5: データベースにテーブルを作成

```bash
npx prisma db push
```

成功すると「✔ Generated Prisma Client」などのメッセージが表示されます。

### ステップ 6: 開発サーバーを起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

**🎉 おめでとうございます！**

これで**認証機能**が使えるようになりました！サインアップしてログインできます。

> **⚠️ 重要**: このアプリの主要機能である**タスク管理・時間計測**を使うには、引き続き [Lambda APIのセットアップ](#-lambda-apiのセットアップ時間計測機能---必須) が**必須**です。Lambda APIなしでは、ログインのみ可能で、タスクの作成・表示はできません。

---

## 📖 詳細セットアップガイド

### 便利な一括起動スクリプト

`start-dev.sh` を使うと、データベース起動からサーバー起動まで一気に実行できます:

```bash
chmod +x start-dev.sh
./start-dev.sh
```

このスクリプトが自動で実行する内容:
1. DockerでPostgreSQLとRedisを起動
2. データベーススキーマを反映
3. 開発サーバーを起動

### Dockerを使わない場合のPostgreSQL設定

#### macOS
```bash
brew install postgresql@15
brew services start postgresql@15

# データベースとユーザーを作成
psql postgres
CREATE DATABASE todoapp;
CREATE USER todouser WITH PASSWORD 'todopass123';
GRANT ALL PRIVILEGES ON DATABASE todoapp TO todouser;
\q
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install postgresql-15
sudo systemctl start postgresql

# データベースとユーザーを作成
sudo -u postgres psql
CREATE DATABASE todoapp;
CREATE USER todouser WITH PASSWORD 'todopass123';
GRANT ALL PRIVILEGES ON DATABASE todoapp TO todouser;
\q
```

#### Windows
[PostgreSQL公式サイト](https://www.postgresql.org/download/windows/)からインストーラーをダウンロードしてインストールしてください。

### クラウドデータベースの使用

無料で使えるクラウドデータベースサービス:

**Vercel Postgres** (Vercelにデプロイする場合に最適)
1. [Vercel Dashboard](https://vercel.com/dashboard) でプロジェクトを作成
2. Storage → Create Database → Postgres を選択
3. 接続URLをコピーして `.env.local` の `DATABASE_URL` に設定

**Neon** (無料プラン充実)
1. [Neon](https://neon.tech/) でアカウント作成
2. プロジェクトを作成
3. 接続URLをコピーして `.env.local` に設定

**Supabase** (PostgreSQL + 追加機能)
1. [Supabase](https://supabase.com/) でプロジェクト作成
2. Database → Connection string → URI からURLを取得
3. `.env.local` に設定

### 環境変数の詳細

`.env.local` で設定できる主な項目:

```env
# === 必須設定 ===

# データベース接続URL
DATABASE_URL="postgresql://ユーザー名:パスワード@ホスト:ポート/データベース名"

# NextAuth認証
NEXTAUTH_SECRET="ランダムな32文字以上の文字列"
NEXTAUTH_URL="http://localhost:3000"

# === Lambda API（タスク管理・時間計測 - 必須）===
# ⚠️ Lambda APIなしではタスク管理機能が一切使えません
# セットアップ手順: https://github.com/yourusername/my-todo-app#lambda-apiのセットアップ
LAMBDA_API_URL="https://your-api-id.execute-api.region.amazonaws.com/prod"
NEXT_PUBLIC_LAMBDA_API_URL="https://your-api-id.execute-api.region.amazonaws.com/prod"

# === オプション設定 ===

# Redis（キャッシュ・リアルタイム同期）
REDIS_URL="redis://localhost:6379"
REDIS_PASSWORD=""

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"

# キャッシュ設定
CACHE_TTL=3600
ENABLE_CACHE=true
ENABLE_REALTIME=true

# タイムアウト設定
LAMBDA_API_TIMEOUT_MS=8000
REDIS_CONNECT_TIMEOUT_MS=7000
```

---

## 🔐 OAuth認証の設定

GitHub または Google アカウントでログインできるようにする設定です（オプション）。

### GitHub OAuth設定

#### ステップ1: GitHub OAuth Appを作成

1. GitHubにログインして [Developer Settings](https://github.com/settings/developers) を開く
2. 左メニューから **OAuth Apps** → **New OAuth App** をクリック
3. 以下の情報を入力:

| 項目 | 値 |
|------|-----|
| Application name | `My Todo App` |
| Homepage URL | `http://localhost:3000` |
| Authorization callback URL | `http://localhost:3000/api/auth/callback/github` |

4. **Register application** をクリック

#### ステップ2: 認証情報を取得

1. **Client ID** をコピー
2. **Generate a new client secret** をクリックして **Client Secret** をコピー

#### ステップ3: 環境変数に設定

`.env.local` に以下を追加:

```env
GITHUB_CLIENT_ID="コピーしたClient ID"
GITHUB_CLIENT_SECRET="コピーしたClient Secret"
```

#### ステップ4: サーバーを再起動

```bash
# Ctrl+C でサーバーを停止して再起動
npm run dev
```

これで GitHub アカウントでログインできるようになります！

---

### Google OAuth設定

#### ステップ1: Google Cloud Projectを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新規プロジェクトを作成（例: `my-todo-app`）

#### ステップ2: OAuth同意画面を設定

1. 左メニュー → **APIとサービス** → **OAuth同意画面**
2. ユーザータイプ: **外部** を選択
3. アプリ情報を入力:
   - **アプリ名**: `My Todo App`
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **デベロッパーの連絡先**: あなたのメールアドレス
4. **保存して次へ** を数回クリック

#### ステップ3: OAuth クライアントIDを作成

1. **APIとサービス** → **認証情報**
2. **認証情報を作成** → **OAuthクライアントID**
3. アプリケーションの種類: **ウェブアプリケーション**
4. 情報を入力:

| 項目 | 値 |
|------|-----|
| 名前 | `My Todo App Web Client` |
| 承認済みのJavaScript生成元 | `http://localhost:3000` |
| 承認済みのリダイレクトURI | `http://localhost:3000/api/auth/callback/google` |

5. **作成** をクリック

#### ステップ4: 認証情報を取得

- **クライアントID** をコピー
- **クライアントシークレット** をコピー

#### ステップ5: 環境変数に設定

`.env.local` に以下を追加:

```env
GOOGLE_CLIENT_ID="コピーしたクライアントID"
GOOGLE_CLIENT_SECRET="コピーしたクライアントシークレット"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="コピーしたクライアントID"
```

#### ステップ6: サーバーを再起動

```bash
npm run dev
```

これで Google アカウントでログインできるようになります！

---

## ⚡ Lambda APIのセットアップ（必須）

このアプリのコア機能である**タスク管理・時間計測**を使うには、AWS Lambda + API Gateway のセットアップが**必須**です。

### Lambda APIについて

**Lambda APIはこのアプリの心臓部です**。Lambda APIなしでは以下の機能が**すべて使えません**:

#### ❌ 使えない機能（Lambda API必須）
- **タスク管理全般**
  - タスクの作成・読取・更新・削除（CRUD）
  - タスクの検索・フィルタリング
  - カテゴリ・タグ管理
  - データエクスポート
- **時間計測機能**
  - 時間計測（Start/Stopボタン）
  - 今日・今週の合計時間表示
  - 時間分析・統計
  - タイムライン表示
  - ランキング機能

#### ✅ Lambda APIなしで使える機能
- ユーザー登録・ログイン（メール/パスワード、OAuth）
- プロフィール表示

> **💡 重要**: Lambda APIなしでは、ログインしか機能しません。このアプリを使うには、Lambda APIのセットアップが必須です。

### 必要なもの

- **AWSアカウント** ([無料アカウント作成](https://aws.amazon.com/jp/free/))
- **クレジットカード** (AWS無料枠内なら課金されません)
- **基本的なAWSの知識** (初めての方は下記の手順を順番に実行してください)

### Lambda関数の実装

時間計測機能用のLambda関数を実装する必要があります。

#### Lambda関数のサンプルコード

`lambda-js/` ディレクトリにサンプルコードが含まれています：

| ファイル | 説明 | 用途 |
|---------|------|------|
| `index_sample.js` | **セキュリティ監査済みのサンプル実装** | 学習・参考用 |
| `index.js` | 本番用の実装（非公開） | 実際のデプロイ用 |
| `ssl-optimized-pg.js` | PostgreSQL接続の最適化設定 | 両方で使用 |
| `package.json` | 依存パッケージの定義 | 両方で使用 |

> **⚠️ 重要なお知らせ:**
> - `index_sample.js` は教育目的のサンプルコードです
> - セキュリティベストプラクティスと実装ガイドが含まれています
> - 本番環境で使用する前に、必ずセキュリティチェックリストを確認してください
> - 実際のパスワードや機密情報は含まれていません

#### 必要なAPIエンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/time-entries/start` | 時間計測開始 |
| POST | `/time-entries/stop` | 時間計測停止 |
| GET | `/time-entries/summary` | 日次・週次サマリ |
| GET | `/time-entries/analytics` | 統計・分析データ |
| GET | `/time-entries/active` | アクティブな計測取得 |
| GET | `/time-entries/tasks` | タスク別時間データ |

### ステップ1: Lambda関数を作成

#### 1.1 AWS Management Consoleにログイン

[AWS Console](https://console.aws.amazon.com/) にアクセスしてログインします。

#### 1.2 Lambda関数を作成

1. サービス検索で「Lambda」を入力して Lambda コンソールを開く
2. **関数の作成** をクリック
3. 以下の情報を入力:
   - **関数名**: `my-todo-time-tracker`
   - **ランタイム**: Node.js 18.x 以上
   - **アーキテクチャ**: x86_64
4. **関数の作成** をクリック

#### 1.3 Lambda関数のコードを準備

Lambda関数のコードをアップロードします。

##### オプション1: サンプルコードを使用（学習・テスト用）

`lambda-js/index_sample.js` をベースに実装します：

1. `index_sample.js` を `index.js` にコピー
   ```bash
   cd lambda-js
   cp index_sample.js index.js
   ```

2. `index.js` を開いて、ファイル冒頭のセキュリティチェックリストを確認

3. 本番環境で必要なセキュリティ対策を実装：
   - [ ] 入力バリデーションの追加
   - [ ] レート制限の実装
   - [ ] 環境変数の設定（`BCRYPT_SALT_ROUNDS` 等）
   - [ ] エラーハンドリングの強化

##### オプション2: 独自実装

`index_sample.js` を参考に、独自のLambda関数を実装します。

**アップロード方法A: コンソールで直接編集**
1. Lambda関数のページで「コード」タブを開く
2. 準備した `index.js` の内容をコピー＆ペースト
3. **Deploy** をクリック

**アップロード方法B: zipファイルでアップロード**
```bash
# lambda-js ディレクトリで実行
cd lambda-js
npm install  # 必要な依存関係をインストール

# 必要なファイルのみをzip化（セキュリティのため）
zip -r function.zip index.js ssl-optimized-pg.js package.json package-lock.json node_modules/
```

Lambda コンソールから「アップロード」→「.zipファイル」で `function.zip` をアップロード

> **セキュリティ注意:**
> - `index_sample.js` はそのままアップロードしないでください
> - 必ず `index.js` としてリネームしてから使用してください
> - 本番環境では追加のセキュリティ対策を実装してください

#### 1.4 環境変数を設定

Lambda関数の「設定」→「環境変数」で以下を設定:

| キー | 値 |
|------|-----|
| `DATABASE_URL` | PostgreSQLの接続URL |
| `NODE_ENV` | `production` |

> **重要**: `DATABASE_URL` は外部からアクセスできるデータベース（Neon、Supabase、AWS RDS等）である必要があります。ローカルのDockerは使えません。

#### 1.5 タイムアウトとメモリを調整

1. 「設定」→「一般設定」→「編集」
2. 以下に変更:
   - **メモリ**: 512 MB
   - **タイムアウト**: 30秒
3. **保存** をクリック

### ステップ2: API Gatewayを作成

#### 2.1 API Gatewayコンソールを開く

1. AWS Consoleで「API Gateway」を検索
2. **APIを作成** をクリック
3. **REST API** を選択（Privateではない方）
4. **構築** をクリック

#### 2.2 APIの設定

1. **新しいAPI** を選択
2. 以下を入力:
   - **API名**: `my-todo-api`
   - **エンドポイントタイプ**: リージョン
3. **APIの作成** をクリック

#### 2.3 リソースを作成

時間計測用のリソースを作成します:

1. **アクション** → **リソースの作成**
2. **リソース名**: `time-entries`
3. **リソースパス**: `time-entries`
4. **リソースの作成** をクリック

#### 2.4 サブリソースを作成

`/time-entries` を選択した状態で、以下のサブリソースを作成:
- `start`
- `stop`
- `summary`
- `analytics`
- `active`
- `tasks`

各サブリソースに対して:
1. **アクション** → **メソッドの作成** → **ANY** を選択
2. 統合タイプ: **Lambda関数**
3. Lambda関数: `my-todo-time-tracker` を選択
4. **保存** → **OK**

#### 2.5 CORSを有効化

各リソース（time-entries, start, stop等）に対して:
1. リソースを選択
2. **アクション** → **CORSの有効化**
3. デフォルト設定のまま **CORSを有効にして既存のCORSヘッダーを置換** をクリック

#### 2.6 APIをデプロイ

1. **アクション** → **APIのデプロイ**
2. デプロイされるステージ: **[新しいステージ]**
3. **ステージ名**: `prod`
4. **デプロイ** をクリック

#### 2.7 APIのURLを取得

デプロイ後、画面上部に **呼び出しURL** が表示されます:
```
https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod
```
このURLをコピーしてください。

### ステップ3: アプリに設定

`.env.local` に Lambda API の URL を設定:

```env
LAMBDA_API_URL="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
NEXT_PUBLIC_LAMBDA_API_URL="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
```

### ステップ4: サーバーを再起動

```bash
# 開発サーバーを再起動
npm run dev
```

### ステップ5: 動作確認

1. ブラウザで [http://localhost:3000](http://localhost:3000) を開く
2. ログイン
3. タスクを作成
4. **Start** ボタンをクリック
5. 右上に時間が表示されれば成功！🎉

---

## 🔒 Lambda関数のセキュリティベストプラクティス

### サンプルコードについて

`lambda-js/index_sample.js` は教育目的のサンプルコードです：

#### ✅ 含まれているもの
- 完全な時間計測APIの実装例
- セキュリティベストプラクティスのコメント
- 10項目のセキュリティチェックリスト
- 入力検証・エラーハンドリングのガイド
- bcrypt、SQLインジェクション対策などの実装例

#### ❌ 含まれていないもの
- 実際のパスワードや機密情報
- 本番環境の接続文字列
- APIキーやトークン
- AWS認証情報

### 本番環境デプロイ前のチェックリスト

`index_sample.js` をベースに本番環境にデプロイする前に、必ず以下を確認してください：

#### 1. セキュリティ対策

```javascript
// ✅ 実装済み確認項目
[ ] bcrypt salt rounds を環境変数化 (BCRYPT_SALT_ROUNDS)
[ ] すべてのSQLクエリでパラメータ化クエリを使用
[ ] パスワードをログに出力しない（マスク処理）
[ ] エラーメッセージに機密情報を含めない
```

#### 2. AWS設定

```bash
# ✅ 設定確認項目
[ ] AWS Secrets Manager でDB接続情報を管理
[ ] VPC内でLambda関数を実行
[ ] セキュリティグループで必要最小限のポート開放
[ ] CloudWatch Logsで機密情報をマスク
[ ] IAMロールを最小権限の原則で設定
```

#### 3. API Gateway

```bash
# ✅ 設定確認項目
[ ] CORS設定を適切に制限
[ ] レート制限を設定（例: 100req/秒）
[ ] APIキーまたは認証を実装
[ ] カスタムドメインの設定（オプション）
```

#### 4. 監視・ログ

```bash
# ✅ 設定確認項目
[ ] CloudWatch Alarmsで異常検知
[ ] X-Rayでパフォーマンス監視
[ ] Lambda関数のタイムアウト設定（推奨: 30秒）
[ ] メモリ設定の最適化（推奨: 512MB）
```

### サンプルコードの使い方

#### 開発・テスト環境での使用

```bash
# 1. サンプルコードをコピー
cd lambda-js
cp index_sample.js index.js

# 2. 必要に応じてカスタマイズ
# - 環境変数の追加
# - エラーハンドリングの強化
# - 追加の入力検証

# 3. ローカルでテスト（SAM CLI等）
sam local invoke MyFunction --event test-event.json

# 4. デプロイ
# zipファイル作成とLambdaアップロード
```

#### 本番環境での使用

```bash
# 1. セキュリティチェックリストを確認
# ファイル末尾のチェックリスト参照

# 2. 環境変数を設定
# AWS Secrets Manager推奨

# 3. コードレビューを実施
# セキュリティの専門家によるレビュー推奨

# 4. セキュリティスキャン実施
npm audit
snyk test

# 5. デプロイ
```

### よくあるセキュリティ上の質問

**Q: `index.js` と `index_sample.js` の違いは？**

**A**:
- `index_sample.js`: 教育用サンプル。機密情報なし、セキュリティガイド付き
- `index.js`: 本番用実装。機密情報や独自のカスタマイズを含む可能性があるため非公開

**Q: `index_sample.js` をそのまま使っても大丈夫？**

**A**:
- 学習・開発環境: ✅ OK（ただし環境変数の設定が必要）
- 本番環境: ⚠️ 追加のセキュリティ対策が必要
  - レート制限の実装
  - 入力検証の強化
  - AWS Secrets Managerの使用
  - VPC内での実行

**Q: セキュリティ監査はどうすればいい？**

**A**: 以下のツールとサービスを推奨：
```bash
# 脆弱性スキャン
npm audit
npm audit fix

# セキュリティ専門ツール
snyk test
eslint --fix

# AWSセキュリティ
AWS Security Hub
AWS GuardDuty
```

---

## 📱 使い方

### 初回起動とアカウント作成

1. [http://localhost:3000](http://localhost:3000) にアクセス
2. **Sign up** をクリック
3. メールアドレスとパスワードを入力
4. または GitHub / Google でサインアップ

### タスクの作成

1. ダッシュボードの **New Task** ボタンをクリック
2. タスク情報を入力:
   - **タイトル**: 例「レポート作成」
   - **説明**: 詳細な内容（オプション）
   - **優先度**: Low / Medium / High / Urgent
   - **カテゴリ**: Work / Personal / Study
   - **タグ**: 複数設定可能（例: #programming #urgent）
   - **期限**: 締切日時
3. **Create** をクリック

### 時間計測の使い方

1. タスク横の **▶️ Start** ボタンをクリック
2. リアルタイムで時間が計測されます
3. 作業終了時に **⏸️ Stop** をクリック
4. 計測データが自動保存されます

### ダッシュボードの見方

#### タスクビュー
- 全タスクの一覧表示
- フィルター機能（優先度、カテゴリ、ステータス）
- 検索とソート
- 選択モードで一括操作

#### 時間ビュー（Lambda API設定後）
- 今日の合計時間
- 今週の合計時間
- 目標との比較
- カテゴリ別分析
- ランキング表示

#### タイムライン（Lambda API設定後）
- 過去の時間計測履歴
- 日付ごとの作業ログ
- タスク別詳細

### データのエクスポート

1. 設定画面（⚙️）を開く
2. **Export Data** セクション
3. **Export as JSON** または **Export as CSV** を選択
4. ファイルがダウンロードされます

---

## 🔧 トラブルシューティング

### よくあるエラーと解決方法

#### エラー: "PrismaClientInitializationError"

**原因**: データベースに接続できない

**解決方法**:
```bash
# 1. PostgreSQLが起動しているか確認
docker ps

# 2. データベーススキーマを再作成
npx prisma db push

# 3. .env.local の DATABASE_URL を確認
```

#### エラー: "Port 3000 is already in use"

**原因**: ポート3000が既に使われている

**解決方法**:
```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# または別のポートで起動
PORT=3001 npm run dev
```

#### 時間計測ボタンが動作しない

**原因**: Lambda APIが未設定または接続できない

**解決方法**:
1. `.env.local` の `LAMBDA_API_URL` を確認
2. Lambda関数が正しくデプロイされているか確認
3. API Gateway の CORS 設定を確認
4. Lambda関数のログを CloudWatch で確認

#### ログイン後に "NextAuth Error"

**原因**: `NEXTAUTH_SECRET` が未設定

**解決方法**:
```bash
# 1. ランダムな文字列を生成
openssl rand -base64 32

# 2. .env.local に設定
NEXTAUTH_SECRET="生成された文字列"

# 3. サーバーを再起動
npm run dev
```

#### Redis接続エラー

**原因**: Redisが起動していない

**解決方法**:
- Redisはオプションなので、エラーが出ても基本機能は使えます
- Redisを使いたい場合:
```bash
docker-compose up -d redis
```

### ログの確認

開発サーバーのターミナルにログが表示されます。エラー詳細はここで確認できます。

**NextAuthのデバッグ:**
```env
# .env.local に追加
NEXTAUTH_DEBUG=true
```

**Lambda関数のログ（AWS）:**
1. AWS Console → CloudWatch → ログ
2. `/aws/lambda/my-todo-time-tracker` を開く

---

## ❓ よくある質問

### Q1: 完全に無料で使えますか？

**A**: はい、以下の条件なら無料です:
- ローカル実行（Docker使用）: 完全無料
- Vercel Hobby プラン: 無料
- AWS Lambda 無料枠: 月100万リクエストまで無料
- Neon/Supabase: 無料プランあり

### Q2: Lambda APIなしでも使えますか？

**A**: いいえ、Lambda APIはこのアプリの心臓部であり、**必須**です。

**Lambda APIなしで使える機能:**
- ✅ ユーザー登録・ログイン（メール/パスワード、OAuth）
- ✅ プロフィール表示

**Lambda APIが必須の機能（このアプリのすべての主要機能）:**
- ❌ **タスク管理全般**（作成・編集・削除・一覧表示）
- ❌ カテゴリ・タグ管理
- ❌ 検索・フィルタリング
- ❌ データエクスポート
- ❌ **時間計測**（Start/Stopボタン）
- ❌ 今日・今週の合計時間表示
- ❌ 時間分析・統計・ランキング
- ❌ タイムライン表示

> **💡 重要**: Lambda APIなしでは、ログインしか機能しません。このアプリを使うには、Lambda APIのセットアップが必須です。AWS無料枠で十分運用可能です。

### Q3: スマホで使えますか？

**A**: はい、レスポンシブデザインでスマホ対応しています。

### Q4: データはどこに保存されますか？

**A**: PostgreSQLデータベースに保存されます:
- ローカル: あなたのPC内
- クラウド: 選択したクラウドサービスのサーバー

### Q5: Redisは必須ですか？

**A**: いいえ、オプションです。Redisがなくても動作しますが、キャッシュ機能が使えません。

### Q6: 他の人とタスクを共有できますか？

**A**: 現在のバージョンは個人用です。チーム機能は今後追加予定です。

### Q7: データをバックアップする方法は？

**A**:
1. **アプリ内**: 設定画面からJSON/CSVでエクスポート
2. **データベース**:
```bash
docker exec -t postgres pg_dump -U todouser todoapp > backup.sql
```

### Q8: 本番環境にデプロイするには？

**A**: Vercelへのデプロイが最も簡単です:

1. [Vercel](https://vercel.com/) でアカウント作成
2. GitHubリポジトリをインポート
3. 環境変数を設定
4. デプロイ！

詳細は [Vercel Documentation](https://vercel.com/docs) を参照してください。

### Q9: AWSの料金が心配です

**A**: AWS Lambda の無料枠:
- **月100万リクエスト** まで無料
- **40万GB-秒** の計算時間まで無料

個人利用なら無料枠内で十分使えます！

### Q10: Lambda関数のデバッグ方法は？

**A**:
1. AWS Console → Lambda → 関数を選択
2. 「モニタリング」→「CloudWatch Logsで表示」
3. 最新のログストリームを開く
4. エラー内容を確認

### Q13: `index_sample.js` には機密情報が含まれていますか？

**A**: いいえ、含まれていません。セキュリティ監査済みです：
- ✅ ハードコードされたパスワードなし
- ✅ データベース接続文字列なし
- ✅ APIキー・トークンなし
- ✅ AWS認証情報なし

すべての機密情報は環境変数またはAWS Secrets Managerから取得する設計になっています。

### Q14: `index.js` ファイルはどこにありますか？

**A**: `lambda-js/index.js` は以下の理由で非公開です：
- 本番環境の接続情報が含まれる可能性
- カスタマイズされた実装
- セキュリティ上の理由

代わりに `index_sample.js` を参考にして独自実装してください。

### Q15: サンプルコードを本番で使っても安全ですか？

**A**: 以下の条件を満たせば使用可能です：

**必須対応:**
- [ ] セキュリティチェックリストの確認（ファイル内参照）
- [ ] 環境変数の適切な設定
- [ ] AWS Secrets Managerでの機密情報管理
- [ ] VPC内でのLambda実行
- [ ] レート制限の実装

**推奨対応:**
- [ ] セキュリティ専門家によるコードレビュー
- [ ] ペネトレーションテスト
- [ ] 脆弱性スキャン（npm audit, snyk）

### Q16: Lambda関数の実装が難しい場合は？

**A**: 以下の代替案があります：

1. **Next.js API Routesのみで実装**
   - Lambda APIを使わず、すべてNext.js内で実装
   - シンプルで管理しやすい
   - ただし、スケーラビリティは劣る

2. **サーバーレスフレームワークの使用**
   - Serverless Framework
   - AWS SAM (Serverless Application Model)
   - より簡単にデプロイ可能

3. **マネージドサービスの利用**
   - Vercel Functions
   - AWS Amplify
   - 設定が簡単

### Q11: エラーが出て困っています

**A**: 以下の順で確認:
1. [トラブルシューティング](#-トラブルシューティング) を確認
2. ターミナルのエラーメッセージを読む
3. `.env.local` の設定を確認
4. データベースが起動しているか確認
5. サーバーを再起動
6. それでも解決しない場合は GitHub Issues で質問

### Q12: TypeScriptのエラーが出ます

**A**:
```bash
# 型エラーを無視してビルド
npm run build
```

ただし、TypeScriptを学習することをお勧めします！

---

## 🐳 Dockerでの実行

すべてをDockerで動かす方法:

```bash
# すべてのサービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f app

# 停止
docker-compose down
```

起動するサービス:
- PostgreSQL（データベース）
- Redis（キャッシュ）
- Next.js アプリ（本番ビルド）
- pgAdmin（DB管理ツール）: http://localhost:5050
- Redis Commander（Redis管理）: http://localhost:8081

---

## 🛠️ 開発者向け情報

### npmスクリプト

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm start` | 本番サーバー起動 |
| `npm run lint` | ESLint実行 |
| `npm run type-check` | TypeScript型チェック |
| `npx prisma studio` | Prisma Studio起動（DB GUI） |
| `npx prisma db push` | スキーマをDBに反映 |

### ディレクトリ構成

```
my-todo-app/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/         # 認証API
│   │   ├── todos/        # タスク管理API
│   │   ├── time-entries/ # 時間計測API（Lambdaへのプロキシ）
│   │   └── ...
│   ├── auth/              # 認証画面（サインイン・サインアップ）
│   ├── dashboard/         # ダッシュボード画面
│   └── components/        # Reactコンポーネント
├── lib/                   # ライブラリとユーティリティ
│   ├── prisma.ts         # Prisma Client設定
│   ├── redis.ts          # Redis接続設定
│   ├── auth.ts           # NextAuth設定
│   ├── lambda-api.ts     # Lambda API クライアント
│   └── ...
├── lambda-js/             # Lambda関数コード（時間計測機能）
│   ├── index_sample.js   # ✅ サンプル実装（セキュリティ監査済み）
│   ├── index.js          # 本番用実装（非公開）
│   ├── ssl-optimized-pg.js # PostgreSQL接続最適化
│   ├── package.json      # Lambda依存パッケージ
│   └── package-lock.json
├── prisma/                # Prismaスキーマとマイグレーション
│   └── schema.prisma     # データベーススキーマ定義
├── docker-compose.yml     # Docker設定（PostgreSQL, Redis等）
├── .env.example           # 環境変数テンプレート
├── .env.local             # 環境変数（gitignore済み）
├── start-dev.sh           # 開発環境一括起動スクリプト
└── package.json           # Next.jsアプリの依存パッケージ
```

#### 重要なファイルの説明

| ファイル/ディレクトリ | 説明 |
|-------------------|------|
| `app/api/time-entries/` | Lambda APIへのプロキシルート（時間計測機能） |
| `lambda-js/index_sample.js` | **学習用サンプルコード**（セキュリティベストプラクティス付き） |
| `lambda-js/index.js` | 本番用Lambda関数（独自実装または機密情報を含む） |
| `.env.example` | 環境変数のテンプレート（すべての設定項目） |
| `start-dev.sh` | Docker起動→Prismaマイグレーション→開発サーバー起動 |

### データベーススキーマ

主要なモデル:
- **User**: ユーザー情報
- **Task (Todo)**: タスク情報
- **TimeEntry**: 時間計測エントリ
- **TimeGoal**: 時間目標設定
- **Category**: カテゴリ
- **Tag**: タグ

詳細は `prisma/schema.prisma` を参照してください。

---

## 📄 ライセンス

このプロジェクトは個人利用・学習目的で作成されています。

---

## 🙏 謝辞

以下のオープンソースプロジェクトを使用しています:
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [Prisma](https://www.prisma.io/)
- [NextAuth.js](https://next-auth.js.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Redis](https://redis.io/)

---

## 📞 サポート

質問や問題が発生した場合:

1. [よくある質問](#-よくある質問) と [トラブルシューティング](#-トラブルシューティング) を確認
2. [GitHub Issues](https://github.com/yourusername/my-todo-app/issues) で質問
3. バグを見つけた場合は Issue を作成

---

## 🖼️ スクリーンショット

### サインイン画面
![Signin](docs/screenshots/auth-signin.png)

### タスクダッシュボード
![Tasks](docs/screenshots/dashboard-tasks.png)

### 時間計測ダッシュボード
![Time](docs/screenshots/dashboard-time.png)

### タイムライン
![TimeLine](docs/screenshots/dashboard-timeline.png)

### 設定画面
![Setting](docs/screenshots/setting.png)

---

**🎉 Happy Coding! タスク管理を楽しんでください！**
