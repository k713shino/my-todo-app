# My Todo App – フルスタックTodoアプリケーション

Next.js(App Router) + AWS（RDS PostgreSQL + Lambda）をベースに、**認証・タスク管理・時間計測**機能を備えたフルスタックアプリケーションです。

> **💡 完全無料で運用可能！** このアプリはAWS無料枠を使って完全無料で運用できます（12ヶ月間）
>
> **🏗️ アーキテクチャ**: このアプリはAWSインフラストラクチャを活用しています：
> - **データベース**: AWS RDS PostgreSQL（db.t3.micro、20GB、パブリックアクセス）- 無料枠で常時稼働
> - **時間計測API**: AWS Lambda + API Gateway（**VPC不使用**）- 月100万リクエストまで無料
> - **ネットワーク**: VPC不使用のシンプル構成 - NAT Gateway料金（月$30〜40）が不要
> - **デプロイ**: Vercel（Next.jsアプリ）- Hobbyプランで無料
>
> **💰 運用コスト**:
> - AWS無料枠内で個人利用なら**完全無料**
> - **VPC不使用**により追加のネットワーク料金なし
> - 無料枠終了後も月$10〜15程度で運用可能（NAT Gateway不要のため低コスト）

![my-todo-app](docs/screenshots/my-todo-app.png)

## 📋 目次

- [機能紹介](#-機能紹介)
- [技術スタック](#-技術スタック)
- [前提条件](#-前提条件)
- [クイックスタート（初心者向け）](#-クイックスタート初心者向け)
- [詳細セットアップガイド](#-詳細セットアップガイド)
- [AWS RDS PostgreSQLのセットアップ（必須）](#-aws-rds-postgresqlのセットアップ必須)
- [Upstash Redisのセットアップ（オプション・推奨）](#-upstash-redis-のセットアップオプション推奨)
- [OAuth認証の設定](#-oauth認証の設定)
- [Lambda APIのセットアップ（必須）](#-lambda-apiのセットアップ必須)
- [Lambda関数のセキュリティベストプラクティス](#-lambda関数のセキュリティベストプラクティス)
- [使い方](#-使い方)
- [トラブルシューティング](#-トラブルシューティング)
  - [初学者が踏みやすい"詰みポイント"と対処法](#️-初学者が踏みやすい詰みポイントと対処法)
  - [よくあるエラーと解決方法](#よくあるエラーと解決方法)
- [よくある質問](#-よくある質問)
- [Dockerでの実行（オプション）](#-dockerでの実行オプション)
- [Vercelへのデプロイ（本番環境）](#-vercelへのデプロイ本番環境)
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
| **データベース** | AWS RDS PostgreSQL (パブリックアクセス) |
| **キャッシュ** | Upstash Redis (オプション) |
| **認証** | NextAuth.js |
| **時間計測API** | AWS Lambda + API Gateway (VPC不使用) |
| **ネットワーク** | VPC不使用（シンプル構成） |
| **デプロイ** | Vercel (推奨) / AWS |

---

## 📦 前提条件

このアプリを動かすために必要なもの:

### 必須
- **Node.js 18以上** ([ダウンロード](https://nodejs.org/))
- **npm** (Node.jsに含まれます)
- **AWS アカウント** (必須) ([無料アカウント作成](https://aws.amazon.com/jp/free/))
  - **AWS RDS PostgreSQL**: データベース（推奨）
  - **AWS Lambda**: タスク管理・時間計測API（必須）

### 推奨
- **Git** ([ダウンロード](https://git-scm.com/))

### オプション（追加機能用）
- **Redis** (キャッシュ・リアルタイム同期を使う場合)
  - Upstash Redis（推奨・完全無料枠あり）
  - ローカルRedis（開発用）

---

## 🚀 クイックスタート（初心者向け完全ガイド）

> **⚠️ 重要：料金について**
> - このガイドは**AWS無料枠**を使用する前提で書かれています
> - 手順を正しく実行すれば**12ヶ月間完全無料**で運用できます
> - **「無料利用枠」テンプレートを必ず選択**してください（選び間違えると課金されます）
> - 無料枠の設定ミスを防ぐため、各ステップで確認ポイントを示しています

このアプリを動かすには**3つの大きなステップ**があります：

### 📌 全体の流れ（所要時間：約30〜60分）

```
ステップA: ローカル環境の準備 (10分) - 無料
    ↓
ステップB: AWS RDS PostgreSQLの作成 (15分) - 無料枠（要注意！）
    ↓
ステップC: AWS Lambda APIの作成 (20分) - 無料枠
    ↓
完成！🎉 - 合計 $0.00
```

> **💰 料金確認ポイント**:
> - **ステップB**: 必ず「無料利用枠」テンプレートを選択
> - **ステップB**: db.t3.microまたはdb.t4g.microを選択
> - **ステップC**: Lambda関数は無料枠内（月100万リクエスト）
> - **予算アラート**: [AWS予算アラートの設定](#aws予算アラートの設定推奨)（強く推奨）

---

## ステップA: ローカル環境の準備（初心者でも簡単！）

### A-1: 必要なソフトウェアをインストール

以下のソフトウェアがインストールされているか確認してください：

#### ✅ Node.js（必須）
```bash
# インストール確認
node --version
# v18.0.0 以上ならOK

npm --version
# 9.0.0 以上ならOK
```

インストールされていない場合：
1. [Node.js公式サイト](https://nodejs.org/)から最新のLTS版をダウンロード
2. インストーラーの指示に従ってインストール
3. ターミナルを再起動して上記コマンドで確認

#### ✅ Git（推奨）
```bash
# インストール確認
git --version
```

インストールされていない場合：[Git公式サイト](https://git-scm.com/)からダウンロード

### A-2: コードをダウンロード

ターミナル（WindowsならPowerShellまたはコマンドプロンプト）を開いて：

```bash
# プロジェクトをダウンロード
# ⚠️ 注意: yourusername を自分のGitHubユーザー名に置き換えてください！
git clone https://github.com/yourusername/my-todo-app.git

# プロジェクトフォルダに移動
cd my-todo-app

# ちゃんと移動できたか確認（ファイル一覧が表示される）
ls
```

> **💡 初心者Tips**:
> - ターミナルって何？→ コマンドを入力してパソコンを操作するアプリです
> - Macなら「ターミナル」、Windowsなら「PowerShell」または「コマンドプロンプト」を起動してください

### A-3: 必要なライブラリをインストール

```bash
npm install
```

**⏰ 待ち時間**: 2〜5分かかります。コーヒーでも飲んで待ちましょう☕

成功すると「added XXX packages」のようなメッセージが表示されます。

### A-4: 環境変数ファイルを準備

```bash
# .env.exampleファイルをコピーして.env.localを作成
cp .env.example .env.local
```

> **💡 初心者Tips**:
> - 環境変数ファイルって何？→ パスワードやAPIキーなどの秘密情報を保存するファイルです
> - `.env.local`は自分のパソコンだけで使うファイルで、Gitにはアップロードされません

### A-5: NEXTAUTH_SECRETを生成

テキストエディタ（メモ帳、VSCode、Sublime Textなど）で`.env.local`を開きます。

ターミナルで以下のコマンドを実行：

```bash
# Mac/Linux
openssl rand -base64 32

# Windows（PowerShell）
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

生成された文字列（例：`abc123xyz...`）をコピーして、`.env.local`の`NEXTAUTH_SECRET`に貼り付けます：

```env
NEXTAUTH_SECRET="ここに生成した文字列を貼り付け"
NEXTAUTH_URL="http://localhost:3000"
```

**✅ ステップA完了！** 次はAWS RDSのセットアップです。

---

## ステップB: AWS RDS PostgreSQLの作成（データベース）

> **💡 これから何をする？**
> - AWS（Amazonのクラウドサービス）でデータベースを作ります
> - タスクやユーザー情報を保存する場所です
> - 無料で12ヶ月間使えます！

### B-1: AWSアカウントを作成（まだ持っていない人）

1. [AWS無料アカウント作成](https://aws.amazon.com/jp/free/)にアクセス
2. 「無料アカウントを作成」をクリック
3. メールアドレス、パスワードを入力
4. クレジットカード情報を入力（無料枠内なら課金されません）
5. 電話番号認証を完了

⏰ **所要時間**: 10分

### B-2: AWS Management Consoleにログイン

1. [AWS Console](https://console.aws.amazon.com/)を開く
2. ログイン

### B-3: RDSデータベースを作成

#### ① RDSサービスを開く

1. 画面上部の検索バーに「**RDS**」と入力
2. 「RDS」をクリック

#### ② データベースを作成開始

1. 左メニューの「**データベース**」をクリック
2. オレンジ色の「**データベースの作成**」ボタンをクリック

#### ③ 設定を入力（コピペでOK！）

以下の通りに設定してください：

**【データベース作成方法】**
- ✅ 標準作成

**【エンジンのオプション】**
- ✅ PostgreSQL

**【エンジンのバージョン】**
- PostgreSQL 15.x（最新のものを選択）

**【テンプレート】** ← ⚠️ **超重要！ここを間違えると課金されます！**
- ✅ **無料利用枠**（Free tier）を選択
- ❌ 「本番稼働用」「開発/テスト」は**選ばないで**ください（課金されます）

> **🛡️ 無料枠確認**: テンプレートで「無料利用枠」を選ぶと、以下が自動的に無料枠の設定になります：
> - DBインスタンスクラス: db.t3.micro または db.t4g.micro
> - ストレージ: 20 GB
> - これで月$0.00です！

**【設定】**
```
DBインスタンス識別子: my-todo-db
マスターユーザー名: todouser
マスターパスワード: 強力なパスワードを設定（メモ帳に保存！）
パスワードの確認: 同じパスワードをもう一度入力
```

> **⚠️ 超重要！**: パスワードは必ずメモ帳などに保存してください。後で使います。

**【インスタンスの設定】**
- DBインスタンスクラス: **db.t3.micro**（無料枠）
- ストレージタイプ: 汎用SSD (gp3)
- 割り当てられたストレージ: **20 GB**

**【接続】**
- パブリックアクセス: **はい**（開発環境用）
- VPCセキュリティグループ: 「新しく作成」

**【追加設定】** ← 開いて設定
- 初期データベース名: **todoapp**（これを忘れると後で困ります！）
- バックアップ: 有効
- 暗号化: 有効

#### ④ 作成実行

1. 一番下までスクロール
2. 「**データベースの作成**」ボタンをクリック
3. ⏰ 5〜10分待つ（ステータスが「利用可能」になるまで）

### B-4: セキュリティグループを設定（外部からアクセスできるようにする）

#### ① データベースを選択

1. 作成した「my-todo-db」をクリック
2. 「**接続とセキュリティ**」タブを開く

#### ② セキュリティグループを編集

1. 「VPCセキュリティグループ」のリンクをクリック（青い文字）
2. 下の方にある「**インバウンドルール**」タブをクリック
3. 「**インバウンドルールを編集**」ボタンをクリック
4. 「**ルールを追加**」をクリック

#### ③ ルールを設定

```
タイプ: PostgreSQL
プロトコル: TCP
ポート範囲: 5432
ソース: マイIP（推奨）または 0.0.0.0/0（どこからでもアクセス可能）
```

> **💡 初心者は「マイIP」を選択してください**。より安全です。

5. 「**ルールを保存**」をクリック

### B-5: 接続情報を取得

#### ① エンドポイントをコピー

1. RDSコンソールに戻る
2. 「my-todo-db」をクリック
3. 「**接続とセキュリティ**」タブ
4. 「**エンドポイント**」の文字列をコピー

例：`my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com`

#### ② DATABASE_URLを作成

以下の形式で接続URLを作ります：

```
postgresql://todouser:あなたのパスワード@エンドポイント:5432/todoapp
```

**具体例：**
```
postgresql://todouser:MyPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp
```

#### ③ .env.localに設定

テキストエディタで`.env.local`を開き、`DATABASE_URL`の行を編集：

```env
DATABASE_URL="postgresql://todouser:MyPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp"
```

### B-6: データベーステーブルを作成

ターミナルで以下のコマンドを実行：

```bash
npx prisma db push
```

成功すると：
```
✔ Generated Prisma Client
```
のようなメッセージが表示されます。

**✅ ステップB完了！** データベースの準備ができました！

---

## ステップC: AWS Lambda APIの作成（時間計測機能）

> **💡 これから何をする？**
> - タスク管理と時間計測のための API を作ります
> - AWS Lambda という「サーバーレス」技術を使います
> - **これも無料枠で使えます**（月100万リクエストまで）

### Lambda とは？（初心者向け説明）

**AWS Lambda** は「サーバーレス」と呼ばれる技術です：

- 🖥️ **サーバー不要**: サーバーを立てたり管理する必要がありません
- ⚡ **自動スケーリング**: アクセスが増えても自動で対応
- 💰 **使った分だけ課金**: 実行した分だけ料金が発生（停止時は$0）
- 🔒 **完全VPC不使用**: VPC（仮想プライベートネットワーク）の設定は不要
  - VPCを使わないため、設定がシンプル
  - インターネット経由でRDSに接続（パブリックアクセス使用）
  - 複雑なネットワーク設定が不要で初心者にも安心

**このアプリでの役割**:
- タスクの作成・読取・更新・削除
- 時間計測の開始・停止
- データベース（RDS）への読み書き

**VPC不使用のメリット**:
- ✅ 設定が簡単（初心者向け）
- ✅ NAT Gatewayが不要（追加料金なし）
- ✅ セキュリティグループの複雑な設定が不要
- ✅ すぐに使える

**セキュリティについて**:
- RDSのセキュリティグループで接続元を制限
- 環境変数でデータベース認証情報を管理
- HTTPS/TLS通信で暗号化
- パブリックアクセスでも十分安全（個人利用の場合）

> **⚠️ 料金確認**:
> - Lambda: 月100万リクエストまで無料（個人利用なら1%未満使用）
> - API Gateway: 月100万リクエストまで無料（12ヶ月間）
> - **VPC不使用**: NAT Gateway料金（月$30〜40）が不要！
> - **設定ミスによる課金リスク**: ほぼありません（使った分だけ課金されるため）

### C-1: Lambda 関数を作成

#### ① Lambda コンソールを開く

1. AWS Console で「**Lambda**」を検索
2. 「Lambda」をクリック
3. オレンジ色の「**関数の作成**」ボタンをクリック

#### ② 関数を設定

**基本情報:**
```
関数名: my-todo-time-tracker
ランタイム: Node.js 18.x（または最新版）
アーキテクチャ: x86_64
```

**権限:**
- 「基本的なLambdaアクセス権限で新しいロールを作成」を選択（デフォルト）

**詳細設定:**
- 「VPCを有効にする」: ✅ **チェックを入れない**（VPC不使用）
  - これが重要！VPCを有効にすると追加料金が発生します

> **💡 VPC不使用の確認**:
> - 「VPCを有効にする」のチェックボックスが**オフ**であることを確認
> - VPCなしでも、RDSの「パブリックアクセス: はい」設定で接続できます
> - NAT Gateway（月$30〜40）の料金が不要になります

「**関数の作成**」をクリック

⏰ **所要時間**: 数秒

### C-2: Lambda 関数コードをアップロード

> **💡 初心者向け**: Lambda 関数のコードは `lambda-js/` フォルダにあります

#### ① コードを準備

ローカルのターミナルで：

```bash
# lambda-js フォルダに移動
cd lambda-js

# サンプルコードをコピー
cp index_sample.js index.js

# 依存関係をインストール
npm install

# zipファイルを作成
zip -r function.zip index.js ssl-optimized-pg.js package.json package-lock.json node_modules/
```

> **📝 Windows の場合**:
> - 7-Zip などを使って上記ファイルを zip 化してください
> - または AWS Console で直接コードを貼り付ける方法もあります（後述）

#### ② Lambda にアップロード

**方法A: zipファイルでアップロード（推奨）**

1. Lambda 関数のページで「**コード**」タブを開く
2. 「**アップロード元**」→「**.zip ファイル**」をクリック
3. `function.zip` を選択してアップロード
4. 「**保存**」をクリック

**方法B: コンソールで直接編集（小規模な場合）**

1. Lambda 関数のページで「**コード**」タブを開く
2. `index.js` の内容を全選択して削除
3. `lambda-js/index_sample.js` の内容をコピー＆ペースト
4. 「**Deploy**」をクリック

### C-3: 環境変数を設定

Lambda 関数にデータベース接続情報を教えます。

1. 「**設定**」タブをクリック
2. 左メニューの「**環境変数**」をクリック
3. 「**編集**」をクリック
4. 「**環境変数を追加**」をクリック

以下の2つを追加：

| キー | 値 |
|------|-----|
| `DATABASE_URL` | ステップBで作成した接続URL |
| `NODE_ENV` | `production` |

**DATABASE_URLの例:**
```
postgresql://todouser:MyPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp
```

5. 「**保存**」をクリック

### C-4: タイムアウトとメモリを調整

1. 「**設定**」→「**一般設定**」→「**編集**」
2. 以下に変更:
   - **メモリ**: 512 MB（無料枠内）
   - **タイムアウト**: 30秒
3. 「**保存**」をクリック

**✅ Lambda 関数の設定完了！** 次は API Gateway の設定です。

### C-5: API Gateway を作成

Lambda 関数に外部からアクセスできるようにします。

#### ① API Gateway コンソールを開く

1. AWS Console で「**API Gateway**」を検索
2. 「API Gateway」をクリック
3. 「**APIを作成**」をクリック

#### ② REST API を選択

1. 「**REST API**」（Private じゃない方）を探す
2. 「**構築**」をクリック

#### ③ API を設定

```
新しいAPI: 選択
API名: my-todo-api
エンドポイントタイプ: リージョン
```

「**APIの作成**」をクリック

### C-6: リソースとメソッドを作成

> **💡 初心者向け**: ここでは{proxy+}という特殊な設定を使って、すべてのリクエストをLambdaに転送します

#### ① プロキシリソースを作成

1. 「**アクション**」→「**リソースの作成**」
2. 「**プロキシリソースとして設定する**」に✅チェック
3. 「**リソースの作成**」をクリック

#### ② Lambda 関数を統合

1. 統合タイプ: 「**Lambda 関数プロキシ**」を選択
2. Lambda 関数: `my-todo-time-tracker` を入力または選択
3. 「**保存**」をクリック
4. 権限追加の確認が出たら「**OK**」をクリック

### C-7: CORS を有効化

Web ブラウザからアクセスできるようにします。

1. 「**/**」（ルート）を選択
2. 「**アクション**」→「**CORSの有効化**」
3. デフォルトのまま「**CORSを有効にして既存のCORSヘッダーを置換**」をクリック
4. 確認画面で「**はい、既存の値を置き換えます**」をクリック

### C-8: API をデプロイ

1. 「**アクション**」→「**APIのデプロイ**」
2. デプロイされるステージ: **[新しいステージ]** を選択
3. ステージ名: `prod` と入力
4. 「**デプロイ**」をクリック

### C-9: API の URL を取得

デプロイ後、画面上部に「**呼び出しURL**」が表示されます：

```
https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod
```

**この URL をコピーしてメモ帳に保存してください！**

### C-10: アプリに API URL を設定

テキストエディタで `.env.local` を開き、以下を追加：

```env
LAMBDA_API_URL="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
NEXT_PUBLIC_LAMBDA_API_URL="https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod"
```

**✅ ステップC完了！** Lambda API の準備ができました！

> **📝 詳細な手順が必要な場合**: より詳しい説明は[Lambda APIのセットアップ（詳細版）](#-lambda-apiのセットアップ必須)を参照してください。

---

## 🎉 完成！アプリを起動しよう

すべてのセットアップが完了したら：

```bash
# 開発サーバーを起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

### 初回ログイン

1. 「**Sign up**」をクリック
2. メールアドレスとパスワードを入力
3. アカウント作成完了！
4. タスクを作成してみましょう

**🎊 おめでとうございます！** これで完全に動作するTodoアプリが使えるようになりました！

---

## 🛡️ AWS予算アラートの設定（推奨）

無料枠を超えて課金される前に通知を受け取る設定です。**必ず設定することを強く推奨します。**

### なぜ必要？

- 設定ミスで課金が発生した場合、すぐに気付ける
- 無料枠を使い切る前に警告が来る
- 完全無料で設定できる

### 設定手順（5分）

#### ① AWS Billing コンソールを開く

1. AWS Console 右上のアカウント名をクリック
2. 「**Billing and Cost Management**」をクリック
3. 左メニューの「**Budgets**」をクリック

#### ② 予算を作成

1. 「**Create budget**」をクリック
2. テンプレート: 「**Zero spend budget**」を選択
   - これは「$0.01でも課金されたら通知」する設定です
3. 「**Use template**」をクリック

#### ③ 通知先を設定

1. 「Budget name」: `my-todo-free-tier-alert` と入力
2. 「Email recipients」: あなたのメールアドレスを入力
3. 「**Create budget**」をクリック

#### ④ 確認メールを承認

1. 登録したメールアドレスに確認メールが届きます
2. メール内の「**Confirm subscription**」リンクをクリック

**✅ 予算アラート設定完了！** これで$0.01でも課金されたらメールが来ます。

> **💡 追加設定（オプション）**:
> - 「Cost budget」で月額$10のアラートも設定できます
> - 無料枠終了後も安心して運用できます

---

## ❓ 困ったときは

### エラーが出たら

1. [トラブルシューティング](#-トラブルシューティング)を確認
2. エラーメッセージをよく読む
3. `.env.local`の設定を再確認
4. ターミナルでサーバーを再起動（Ctrl+C → `npm run dev`）

### 質問がある場合

[よくある質問](#-よくある質問)セクションをチェックしてください。

---

## 📖 詳細セットアップガイド

## 🗄️ AWS RDS PostgreSQLのセットアップ（必須）

このアプリは**AWS RDS PostgreSQL**を使用してデータを管理します。以下の手順でセットアップしてください。

### ステップ1: RDSデータベースインスタンスを作成

#### 1.1 AWS Management Consoleにログイン

[AWS Console](https://console.aws.amazon.com/) にアクセスしてログインします。

#### 1.2 RDSコンソールを開く

1. サービス検索で「RDS」を入力してRDSコンソールを開く
2. **データベースの作成** をクリック

#### 1.3 データベース設定

**基本設定:**
- **エンジンのオプション**: PostgreSQL
- **バージョン**: PostgreSQL 15.x（最新の安定版推奨）
- **テンプレート**: 無料利用枠（学習・開発用）または本番稼働用

**設定:**
- **DBインスタンス識別子**: `my-todo-db`（任意の名前）
- **マスターユーザー名**: `todouser`（推奨）
- **マスターパスワード**: 強力なパスワードを設定（後で使用）
- **パスワードの確認**: 同じパスワードを再入力

**インスタンスの設定:**
- **DBインスタンスクラス**:
  - 無料枠: `db.t3.micro` または `db.t4g.micro`
  - 本番: `db.t3.small` 以上
- **ストレージタイプ**: 汎用SSD (gp3)
- **割り当てられたストレージ**: 20 GB（無料枠内）

**接続:**
- **パブリックアクセス**: はい（開発環境の場合）
  - ⚠️ 本番環境ではVPC内からのみアクセス推奨
- **VPCセキュリティグループ**: 新しいセキュリティグループを作成
- **アベイラビリティーゾーン**: 指定なし

**データベース認証:**
- **データベース認証オプション**: パスワード認証

**追加設定:**
- **初期データベース名**: `todoapp`
- **バックアップ**: 有効（推奨）
- **バックアップ保持期間**: 7日間（推奨）
- **暗号化**: 有効（推奨）

#### 1.4 データベースを作成

**データベースの作成** をクリックします。作成には5〜10分かかります。

### ステップ2: セキュリティグループの設定

#### 2.1 セキュリティグループを編集

1. 作成したデータベースを選択
2. **接続とセキュリティ** タブを開く
3. **VPCセキュリティグループ** のリンクをクリック

#### 2.2 インバウンドルールを追加

1. **インバウンドルール** タブを選択
2. **インバウンドルールを編集** をクリック
3. **ルールを追加** をクリック

**開発環境用（セキュリティ低）:**
- **タイプ**: PostgreSQL
- **プロトコル**: TCP
- **ポート範囲**: 5432
- **ソース**: マイIP（自動検出）または 0.0.0.0/0（すべて許可）

**本番環境用（推奨）:**
- **タイプ**: PostgreSQL
- **プロトコル**: TCP
- **ポート範囲**: 5432
- **ソース**: VPC内のセキュリティグループまたは特定のIPアドレス

4. **ルールを保存** をクリック

> **⚠️ セキュリティ警告**: `0.0.0.0/0`（すべて許可）は開発環境のみで使用してください。本番環境では必ず特定のIPまたはVPC内からのアクセスに制限してください。

### ステップ3: 接続情報を取得

#### 3.1 エンドポイントを確認

1. RDSコンソールでデータベースを選択
2. **接続とセキュリティ** タブを開く
3. **エンドポイント** をコピー

例: `my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com`

#### 3.2 DATABASE_URLを作成

以下の形式で接続URLを作成します:

```
postgresql://[ユーザー名]:[パスワード]@[エンドポイント]:5432/[データベース名]
```

**例:**
```
postgresql://todouser:YourPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp
```

### ステップ4: 接続テスト

データベースへの接続をテストします:

```bash
# PostgreSQLクライアントツールで接続テスト
psql "postgresql://todouser:YourPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp"

# または、Prismaで接続テスト
npx prisma db push
```

成功すれば、AWS RDS PostgreSQLのセットアップは完了です！

### AWS RDS無料枠について（完全無料運用の実績あり）

**✅ 実証済み**: このアプリは実際にAWS無料枠で完全無料で運用しています！

AWS RDSの無料枠（12ヶ月間）:
- **インスタンス**: db.t3.micro または db.t4g.micro
- **ストレージ**: 20 GB（汎用SSD gp3）
- **バックアップストレージ**: 20 GB
- **月間稼働時間**: 750時間（常時稼働可能 = 24時間×31日）

**個人利用での実績:**
- ✅ **データベース**: db.t3.micro で常時稼働中
- ✅ **Lambda API**: 月間数千〜数万リクエスト（無料枠の1%未満）
- ✅ **料金**: $0.00（完全無料）
- ✅ **パフォーマンス**: レスポンス良好、遅延なし

> **💡 ヒント**:
> - 個人利用なら無料枠で十分です
> - 無料枠終了後も、db.t3.microは月$10〜15程度
> - Lambda無料枠は永続（月100万リクエストまで無料）

### 代替: 他のクラウドデータベースサービス

AWS RDS以外のオプション:

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

> **📝 注意**: このREADMEではAWS RDSを推奨していますが、上記のサービスでも問題なく動作します。

### 環境変数の詳細

`.env.local` で設定できる主な項目:

```env
# === 必須設定 ===

# データベース接続URL（AWS RDS PostgreSQL）
DATABASE_URL="postgresql://todouser:YourPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp"

# NextAuth認証
NEXTAUTH_SECRET="ランダムな32文字以上の文字列"
NEXTAUTH_URL="http://localhost:3000"

# === Lambda API（タスク管理・時間計測 - 必須）===
# ⚠️ Lambda APIなしではタスク管理機能が一切使えません
# セットアップ手順: このREADMEの「Lambda APIのセットアップ」を参照
LAMBDA_API_URL="https://your-api-id.execute-api.ap-northeast-1.amazonaws.com/prod"
NEXT_PUBLIC_LAMBDA_API_URL="https://your-api-id.execute-api.ap-northeast-1.amazonaws.com/prod"

# === オプション設定 ===

# Redis（キャッシュ・リアルタイム同期）
# Upstash Redis（推奨・無料枠あり）
REDIS_URL="rediss://your-upstash-endpoint:6379"
REDIS_PASSWORD="your-upstash-password"

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

## 🚀 Upstash Redis のセットアップ（オプション・推奨）

> **💡 これから何をする？**
> - Upstash（クラウドRedis）でキャッシュサーバーを作ります
> - アプリの高速化とリアルタイム同期に使います
> - **完全無料枠**で使えます！（毎日10,000リクエストまで）

Redisはオプション機能ですが、以下のメリットがあります：
- ✅ **パフォーマンス向上**: データベースの負荷を減らし、高速化
- ✅ **リアルタイム同期**: 複数デバイスでの同期が可能
- ✅ **完全無料**: 個人利用なら無料枠で十分

### ステップ1: Upstashアカウントを作成

1. [Upstash Console](https://console.upstash.com/) にアクセス
2. 「**Sign up**」をクリック
3. GitHub、Google、またはメールでサインアップ

⏰ **所要時間**: 2分

### ステップ2: Redisデータベースを作成

#### ① Redisを新規作成

1. ログイン後、「**Create Database**」をクリック

#### ② 設定を入力（初心者向け設定）

**【Name】**
```
my-todo-redis
```

**【Type】**
- ✅ **Regional**（推奨・無料枠）

**【Region】**
- 「**ap-northeast-1**」（東京）を選択
  - アプリと同じリージョンを選ぶと高速です

**【TLS (SSL)】**
- ✅ Enabled（セキュリティのため必須）

**【Eviction】**
- **No Eviction**（推奨）

#### ③ 作成実行

1. 「**Create**」ボタンをクリック
2. ⏰ 数秒で完成！

### ステップ3: 接続情報を取得

#### ① データベース詳細を開く

1. 作成した「my-todo-redis」をクリック

#### ② 接続URLをコピー

画面に表示される以下の情報をメモ帳にコピー：

```
UPSTASH_REDIS_REST_URL=https://xxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXXXxxxXXXxxx
```

または、「**Node.js**」タブを開いて以下をコピー：

```
REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:6379
```

### ステップ4: 環境変数に設定

テキストエディタで`.env.local`を開き、以下を追加：

**方法1: REST API（推奨）**
```env
# Upstash Redis（REST API）
UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXXXxxxXXXxxx"
```

**方法2: 従来のRedis接続**
```env
# Upstash Redis（従来の方法）
REDIS_URL="rediss://default:xxxxx@xxxxx.upstash.io:6379"
REDIS_PASSWORD=""  # パスワードはURLに含まれているので空でOK
```

### ステップ5: 動作確認

サーバーを再起動：

```bash
# Ctrl+C で停止
npm run dev
```

ログに以下のようなメッセージが出れば成功：

```
✓ Redis connected successfully
```

**✅ Upstash Redisのセットアップ完了！** これでアプリが高速化されました！

### Upstash無料枠について（完全無料で使える！）

**✅ 実証済み**: このアプリは実際にUpstash無料枠で完全無料で運用しています！

**無料枠（Free Plan）:**
- **毎日のリクエスト数**: 10,000リクエスト/日
- **データサイズ**: 256 MB
- **TLS/SSL**: 有効
- **期間**: 永続（期限なし）

**個人利用での実績:**
- ✅ 毎日のリクエスト: 数百〜数千回（無料枠の10〜30%）
- ✅ 料金: $0.00（完全無料）
- ✅ パフォーマンス: レスポンス良好、遅延なし

> **💡 Tips**:
> - 個人利用なら無料枠で十分です
> - Upstashは「従量課金なし」の無料枠なので安心
> - リクエスト超過時は自動的にスローダウン（課金なし）

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
| `DATABASE_URL` | AWS RDS PostgreSQLの接続URL |
| `NODE_ENV` | `production` |

> **重要**: `DATABASE_URL` には、先ほど作成したAWS RDS PostgreSQLの接続URLを設定してください。
>
> **例:**
> ```
> postgresql://todouser:YourPassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp
> ```
>
> **セキュリティのベストプラクティス**: 本番環境ではAWS Secrets Managerを使用してデータベース接続情報を管理することを強く推奨します。

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

### ⚠️ 初学者が踏みやすい"詰みポイント"と対処法

このセクションでは、README通りに進めても**見落としがちな設定ミス**や**矛盾する設定**について解説します。エラーが出る前に確認してください！

---

#### 詰みポイント1: リポジトリURLがプレースホルダのまま

**何が起きる？**
READMEのクローン手順に書かれている `yourusername` のままコピー&ペーストすると、存在しないリポジトリにアクセスしようとしてエラーになります。

**該当箇所:**
```bash
git clone https://github.com/yourusername/my-todo-app.git
```

**対処法:**
1. GitHubで自分のユーザー名を確認（例: `k713shino`）
2. リポジトリ名を確認（例: `my-todo-app`）
3. 正しいURLに置き換えてクローン:
```bash
git clone https://github.com/あなたのユーザー名/リポジトリ名.git
```

**正しい例:**
```bash
git clone https://github.com/k713shino/my-todo-app.git
```

> **💡 Tip**: GitHubのリポジトリページにある緑色の「Code」ボタンをクリックすると、正しいURLをコピーできます。

---

#### 詰みポイント2: DB準備はできても、Prisma反映を忘れる

**何が起きる？**
AWS RDSでデータベースを作成し、`DATABASE_URL` を `.env.local` に設定しても、**テーブルが作成されていない**ため、アプリ起動時にエラーが発生します。

**エラーメッセージ例:**
```
PrismaClientInitializationError: Table 'User' does not exist
```

**原因:**
`.env.local` に `DATABASE_URL` を設定しただけでは、データベースは空のままです。Prismaのスキーマ（テーブル定義）を反映させる `npx prisma db push` コマンドを実行する必要があります。

**対処法（必須手順）:**
```bash
# 1. .env.local に DATABASE_URL を設定
# 2. Prismaでテーブルを作成（これを忘れずに！）
npx prisma db push

# 3. 成功すると以下のようなメッセージが表示されます
# ✔ Generated Prisma Client
# Your database is now in sync with your schema.
```

**確認方法:**
```bash
# Prisma Studioでテーブルが作成されたか確認
npx prisma studio
# ブラウザで http://localhost:5555 が開き、テーブル一覧が表示されればOK
```

> **⚠️ 重要**: `DATABASE_URL` 設定 → `npx prisma db push` の順番を必ず守ってください。

---

#### 詰みポイント3: Lambda/API を飛ばすとアプリが"動いている風"で実機能が動かない

**何が起きる？**
アプリは起動してログインもできるが、以下の機能が全く動作しない:
- ✗ タスクの作成
- ✗ 時間計測の開始/停止
- ✗ データの保存

**原因:**
Lambda APIのセットアップ（READMEのセクションC）を完了していないか、環境変数 `LAMBDA_API_URL` / `NEXT_PUBLIC_LAMBDA_API_URL` が未設定です。

**対処法:**

**ステップ1: Lambda APIをセットアップ**
READMEの以下のセクションを必ず完了してください:
- [C-1: Lambda 関数を作成](#c-1-lambda-関数を作成)
- [C-2: コードをアップロード](#c-2-コードをアップロード)
- [C-3: 環境変数を設定](#c-3-環境変数を設定)
- [C-4: API Gatewayを設定](#c-4-api-gatewayを設定)
- [C-5: 関数URLを取得](#c-5-関数urlを取得)

**ステップ2: 環境変数を設定**
`.env.local` に以下を追加:
```env
# Lambda APIのURL（C-5で取得したURL）
LAMBDA_API_URL="https://abc123def4.execute-api.ap-northeast-1.amazonaws.com"
NEXT_PUBLIC_LAMBDA_API_URL="https://abc123def4.execute-api.ap-northeast-1.amazonaws.com"

# Lambda APIキー（C-4で設定したキー）
LAMBDA_API_KEY="your-api-key-here"
```

**ステップ3: サーバーを再起動**
```bash
# 開発サーバーを停止（Ctrl+C）
# 再起動
npm run dev
```

**確認方法:**
1. アプリでタスクを作成してみる
2. ブラウザの開発者ツール（F12）→「Console」タブでエラーを確認
3. エラーが出なければ成功

> **💡 Tip**: Lambda APIなしでも動作確認したい場合は、Next.js API Routes（`app/api/`）を使用する方法もあります。

---

#### 詰みポイント4: 最大の躓き - RDSの"マイIP"制限 × VPC未接続Lambda の矛盾 🚨

**これが最も厄介な問題です！** READMEの推奨設定に従うと、矛盾が発生します。

**何が起きる？**
- ✅ ローカル開発環境（自分のPC）からRDSに接続できる
- ✗ Lambda関数からRDSに接続できない（タイムアウトエラー）

**原因:**
READMEでは以下の2つを推奨していますが、これらは**矛盾**します:

1. **「VPC不使用のLambdaでシンプル運用」** （READMEのセクションC）
   - Lambda関数はVPCの外（パブリックインターネット）から実行される
   - 送信元IPは毎回変わる

2. **「RDSのセキュリティグループでマイIPのみ許可（推奨）」** （READMEのセクションB）
   - RDSは「あなたのPC」のIPアドレスからのみアクセス可能
   - Lambda（VPC外）のIPアドレスは許可されていない

**結果:** Lambda → RDS の接続が **ブロック** されます。

---

**対処法の選択肢（安全度順）**

##### 対処法A: Lambda を VPC 内に入れる（最も安全・推奨）

**メリット:**
- ✅ セキュリティが最も高い
- ✅ RDSへの到達性が確実
- ✅ IPアドレス制限が不要

**デメリット:**
- ⚠️ 設定がやや複雑
- ⚠️ NAT Gatewayが必要な場合は料金がかかる（月$30〜40）

**設定手順:**

1. **VPCとサブネットを作成**（既にRDS用に作成済みならスキップ）
   - AWSコンソール → VPC → 「VPCを作成」
   - 推奨: "VPCなど"を選択（サブネット、ルートテーブルも自動作成）

2. **Lambda関数をVPCに配置**
   - Lambda関数の「設定」→「VPC」をクリック
   - 「編集」をクリック
   - **VPC**: RDSと同じVPCを選択
   - **サブネット**: RDSと同じサブネット、または同じVPC内のプライベートサブネットを選択
   - **セキュリティグループ**: 新規作成または既存のものを選択
   - 「保存」をクリック

3. **RDSのセキュリティグループを更新**
   - RDSのセキュリティグループ → インバウンドルール → 「編集」
   - タイプ: PostgreSQL
   - ポート: 5432
   - ソース: **Lambda関数のセキュリティグループ** を選択（IPアドレスではなくSG指定）
   - 「保存」

4. **Lambda関数のタイムアウトを延長**
   - VPC内のLambdaは初回起動が遅いため
   - 「設定」→「一般設定」→「タイムアウト」を30秒以上に設定

> **💡 NAT Gatewayについて:**
> Lambda関数が外部API（例: GitHub API）を呼び出す場合のみNAT Gatewayが必要です。
> RDS接続のみならNAT Gatewayは不要です（料金もかかりません）。

---

##### 対処法B: RDSを"0.0.0.0/0"で一時解放（開発・検証限定）

**メリット:**
- ✅ 設定が簡単
- ✅ VPC設定不要
- ✅ すぐに動作確認できる

**デメリット:**
- ❌ セキュリティリスクが高い（全世界からアクセス可能）
- ❌ 本番環境では絶対に使用しない

**設定手順（開発環境のみ）:**

1. **RDSのセキュリティグループを編集**
   - AWSコンソール → EC2 → セキュリティグループ
   - RDS用のセキュリティグループを選択
   - 「インバウンドルール」→「編集」
   - 既存の「マイIP」ルールを削除または無効化
   - 「ルールを追加」:
     - タイプ: PostgreSQL
     - ポート: 5432
     - ソース: `0.0.0.0/0` （カスタム）
     - 説明: `Temporary - Development Only`
   - 「保存」

2. **Lambda関数をテスト**
   - Lambda関数のページで「テスト」タブ → 「呼び出し」
   - CloudWatch Logsでエラーがないか確認

3. **⚠️ 本番環境にデプロイする前に必ず対処法Aに切り替える**

> **🚨 重要な警告:**
> - この設定は**開発・検証期間のみ**使用してください
> - 強力なパスワードを設定していても、ブルートフォース攻撃のリスクがあります
> - 本番環境では絶対に使用しないでください
> - 使用後は速やかに対処法Aまたは対処法Cに切り替えてください

---

##### 対処法C: "マイIP"＋ローカル実行のみ（Lambda機能なし）

**メリット:**
- ✅ 最もセキュアなRDS設定を維持
- ✅ ローカル開発には十分

**デメリット:**
- ❌ Lambda機能（時間計測など）が使えない
- ❌ 本番環境にデプロイできない

**この方法が適している場合:**
- READMEのLambda機能を使わない
- Next.js API Routes（`app/api/`）だけで実装
- ローカル開発環境だけで動作確認したい

**設定:**
- RDSのセキュリティグループ: 「マイIP」のまま
- Lambda関数: 作成しない
- `.env.local`: `LAMBDA_API_URL` を設定しない

---

**推奨する対処法:**

| 状況 | 推奨対処法 |
|------|-----------|
| 本番環境にデプロイする予定 | **対処法A（VPC内Lambda）** |
| 開発中、動作確認だけしたい | 対処法B（期間限定） → 本番前にAへ移行 |
| Lambdaを使わない | 対処法C（ローカルのみ） |

---

#### 詰みポイント5: 認証の初期設定を忘れる

**何が起きる？**
アプリにアクセスすると、以下のようなエラーが表示されます:
```
[next-auth][error][NO_SECRET]
Please define a `NEXTAUTH_SECRET` environment variable
```

**原因:**
`.env.local` に `NEXTAUTH_SECRET` が設定されていません。この値はNextAuthがセッション（ログイン状態）を暗号化するために必須です。

**対処法:**

**ステップ1: ランダムな秘密キーを生成**

**Mac/Linux:**
```bash
openssl rand -base64 32
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**オンラインツール:**
- https://generate-secret.vercel.app/32

**ステップ2: .env.local に設定**
```env
# ログイン認証用の秘密キー
NEXTAUTH_SECRET="生成された文字列をここに貼り付け"
```

**ステップ3: サーバーを再起動**
```bash
# Ctrl+C で停止
npm run dev
```

**確認方法:**
1. ブラウザで `http://localhost:3000` にアクセス
2. エラーが消えていればOK

> **💡 セキュリティTips:**
> - この値は絶対にGitHubに公開しないでください
> - チームメンバーとも共有せず、各自で生成してもらってください
> - 定期的に変更することを推奨（変更すると全ユーザーがログアウトされます）

---

### 📋 初期設定チェックリスト

すべての設定が完了したか、以下のチェックリストで確認してください:

**データベース関連:**
- [ ] AWS RDSでPostgreSQLデータベースを作成
- [ ] `.env.local` に `DATABASE_URL` を設定
- [ ] `npx prisma db push` でテーブルを作成
- [ ] `npx prisma studio` でテーブルが表示されることを確認

**Lambda API関連（時間計測機能を使う場合）:**
- [ ] Lambda関数を作成
- [ ] Lambda関数にコードをアップロード
- [ ] Lambda関数の環境変数（`DATABASE_URL`）を設定
- [ ] API Gateway/関数URLを設定
- [ ] `.env.local` に `LAMBDA_API_URL` を設定
- [ ] Lambda → RDS の接続が成功することを確認（VPC設定など）

**認証関連:**
- [ ] `.env.local` に `NEXTAUTH_SECRET` を設定

**セキュリティ関連:**
- [ ] RDSのセキュリティグループを適切に設定
  - 開発: 「マイIP」または「Lambda SG」
  - 本番: 「Lambda SG」のみ
- [ ] Lambda関数のVPC設定を確認（本番環境の場合）

**動作確認:**
- [ ] `npm run dev` でローカルサーバーが起動
- [ ] `http://localhost:3000` にアクセスできる
- [ ] ログインできる
- [ ] タスクを作成できる
- [ ] 時間計測が動作する（Lambda使用時）

すべてにチェックが入ったら、準備完了です！

---

### よくあるエラーと解決方法

#### エラー: "PrismaClientInitializationError"

**原因**: データベースに接続できない

**解決方法**:
```bash
# 1. AWS RDS PostgreSQLが起動しているか確認
# AWS RDSコンソールで状態を確認

# 2. セキュリティグループの設定を確認
# ポート5432が開いているか、適切なIPからのアクセスが許可されているか

# 3. .env.local の DATABASE_URL を確認
# エンドポイント、ユーザー名、パスワードが正しいか

# 4. データベーススキーマを再作成
npx prisma db push
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

**原因**: Redisが起動していないまたは接続できない

**解決方法**:
- Redisはオプションなので、エラーが出ても基本機能は使えます
- Upstash Redisを使う場合:
  1. [Upstash Console](https://console.upstash.com/)でデータベースの状態を確認
  2. `.env.local` の `REDIS_URL` または `UPSTASH_REDIS_REST_URL` を確認
  3. TLS/SSL有効で接続していることを確認（`rediss://`で始まる）
  4. パスワードまたはトークンが正しいか確認
- ローカルRedisを使う場合（開発環境）:
```bash
# Dockerでローカル起動
docker run -d -p 6379:6379 redis:alpine
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

**A**: ✅ **はい、完全無料で運用できます！** 実際に無料で運用している実績があります。

**完全無料構成での運用実績:**
- ✅ **AWS RDS PostgreSQL**: db.t3.micro、20GB - 常時稼働で$0.00（12ヶ月無料枠）
- ✅ **AWS Lambda**: 月100万リクエストまで無料（永続） - 個人利用なら余裕
- ✅ **API Gateway**: 月100万リクエストまで無料（12ヶ月）
- ✅ **Upstash Redis**: 毎日10,000リクエスト無料（永続） - 課金なし
- ✅ **Vercel Hobby**: Next.jsアプリのホスティング無料（永続）

**実際の月間利用状況（個人利用）:**
- RDS稼働時間: 750時間（上限いっぱい、常時稼働）
- Lambdaリクエスト: 数千〜数万回（無料枠の1%未満）
- Upstash Redisリクエスト: 数百〜数千回/日（無料枠の10〜30%）
- **合計料金: $0.00**

**無料枠終了後の料金目安:**
- RDS db.t3.micro: 月$10〜15（13ヶ月目以降）
- Lambda: 個人利用ならほぼ無料（無料枠は永続）
- Upstash Redis: 個人利用なら無料枠で十分（無料枠は永続）
- Vercel: 無料プラン継続可能（永続）

> **💡 結論**: 個人利用なら12ヶ月間は完全無料。その後も月$10〜15程度で運用可能です。

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

**A**: AWS RDS PostgreSQLに保存されます:
- **保存場所**: 選択したAWSリージョン（例: 東京リージョン ap-northeast-1）
- **セキュリティ**: 暗号化、自動バックアップ、VPC内分離が可能
- **可用性**: AWSの高可用性インフラストラクチャで管理

### Q5: Redisは必須ですか？

**A**: いいえ、オプションです。Redisがなくても動作しますが、以下の機能が使えません：

**Redisなしでも使える機能:**
- ✅ すべての基本機能（タスク管理、時間計測）
- ✅ 認証機能
- ✅ データの保存・読み込み

**Redisがあると使える追加機能:**
- ✅ **高速化**: データベースへの問い合わせを減らし、レスポンスが速くなる
- ✅ **リアルタイム同期**: 複数デバイスでの同期が可能
- ✅ **セッション管理**: ログイン状態の高速化

**推奨**: Upstash Redisは無料枠で使えるので、設定することをおすすめします！

### Q6: VPCを使わなくても大丈夫ですか？セキュリティは？

**A**: ✅ **はい、VPC不使用でも十分安全です！** このアプリは意図的にVPCを使わない設計にしています。

**VPC不使用の理由:**
- ✅ **初心者にやさしい**: 複雑なネットワーク設定が不要
- ✅ **コスト削減**: NAT Gateway（月$30〜40）が不要
- ✅ **設定が簡単**: すぐに使い始められる
- ✅ **個人利用に最適**: 小規模アプリには十分

**セキュリティ対策（VPCなしでも安全）:**

| セキュリティ項目 | 対策内容 |
|---------------|---------|
| **データベース接続** | RDSセキュリティグループでIP制限 |
| **通信の暗号化** | HTTPS/TLS通信（全て暗号化） |
| **認証情報** | 環境変数で管理（コードに含めない） |
| **パスワード** | bcryptでハッシュ化 |
| **SQLインジェクション** | Prisma ORMで自動防御 |

**VPCが必要なケース:**
- ❌ 個人利用: 不要
- ❌ 小規模チーム（〜10人）: 不要
- ⚠️ 企業利用: 検討が必要
- ⚠️ 機密情報を扱う: 検討が必要

**実績:**
- ✅ このアプリは実際にVPC不使用で運用中
- ✅ セキュリティ上の問題は発生していません
- ✅ 料金: $0.00（VPC料金なし）

> **💡 結論**: 個人利用や学習目的なら、VPC不使用で問題ありません。むしろシンプルで低コストです！

### Q7: 他の人とタスクを共有できますか？

**A**: 現在のバージョンは個人用です。チーム機能は今後追加予定です。

### Q8: データをバックアップする方法は？

**A**:
1. **アプリ内エクスポート**: 設定画面からJSON/CSVでエクスポート
2. **AWS RDS自動バックアップ**: AWS RDSで自動的にバックアップが作成されます
   - 保持期間: 7日間（設定可能）
   - バックアップウィンドウ: AWSが自動で選択
3. **手動スナップショット**: RDSコンソールから手動でスナップショット作成可能
4. **データベースダンプ（手動）**:
```bash
# ローカルにバックアップを作成
pg_dump "postgresql://todouser:password@your-rds-endpoint:5432/todoapp" > backup.sql

# バックアップから復元
psql "postgresql://todouser:password@your-rds-endpoint:5432/todoapp" < backup.sql
```

### Q9: 本番環境にデプロイするには？

**A**: Vercelへのデプロイが最も簡単です:

1. [Vercel](https://vercel.com/) でアカウント作成
2. GitHubリポジトリをインポート
3. 環境変数を設定
4. デプロイ！

詳細は [Vercel Documentation](https://vercel.com/docs) を参照してください。

### Q10: AWSの料金が心配です

**A**: 安心してください！個人利用なら無料枠で十分です。

**実際の運用データ（完全無料）:**

**RDS PostgreSQL:**
- 無料枠: 月750時間（db.t3.micro/db.t4g.micro）
- 実際の使用: 750時間（24時間×31日、常時稼働）
- 料金: $0.00

**Lambda:**
- 無料枠: 月100万リクエスト + 40万GB-秒
- 実際の使用: 月数千〜数万リクエスト（無料枠の1%未満）
- 料金: $0.00（永続無料枠）

**API Gateway:**
- 無料枠: 月100万リクエスト（12ヶ月間）
- 実際の使用: Lambdaと同程度
- 料金: $0.00

**Upstash Redis:**
- 無料枠: 毎日10,000リクエスト（永続）
- 実際の使用: 数百〜数千回/日（無料枠の10〜30%）
- 料金: $0.00（永続無料枠）

**💰 無料枠終了後（13ヶ月目以降）の料金:**
- RDS db.t3.micro: 月$10〜15
- Lambda: ほぼ無料（無料枠は永続）
- API Gateway: 月$3〜5
- Upstash Redis: $0（無料枠は永続）
- Vercel: $0（無料プラン継続）

**合計: 月$15〜20程度（個人利用の場合）**

> **💡 Tips**:
> - 無料期間中に試してみて、継続するか判断できます
> - 不要になったらいつでも削除可能（課金停止）
> - 予算アラートを設定すれば安心（AWS Budgets）

### Q11: Lambda関数のデバッグ方法は？

**A**:
1. AWS Console → Lambda → 関数を選択
2. 「モニタリング」→「CloudWatch Logsで表示」
3. 最新のログストリームを開く
4. エラー内容を確認

### Q15: `index_sample.js` には機密情報が含まれていますか？

**A**: いいえ、含まれていません。セキュリティ監査済みです：
- ✅ ハードコードされたパスワードなし
- ✅ データベース接続文字列なし
- ✅ APIキー・トークンなし
- ✅ AWS認証情報なし

すべての機密情報は環境変数またはAWS Secrets Managerから取得する設計になっています。

### Q16: `index.js` ファイルはどこにありますか？

**A**: `lambda-js/index.js` は以下の理由で非公開です：
- 本番環境の接続情報が含まれる可能性
- カスタマイズされた実装
- セキュリティ上の理由

代わりに `index_sample.js` を参考にして独自実装してください。

### Q17: サンプルコードを本番で使っても安全ですか？

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

### Q18: Lambda関数の実装が難しい場合は？

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

### Q12: 本当に無料で運用できますか？実績を教えてください

**A**: ✅ **はい、実際に完全無料で運用しています！**

**実際の運用実績（2024年〜）:**

| サービス | プラン | 月間使用量 | 料金 |
|---------|-------|-----------|------|
| AWS RDS PostgreSQL | db.t3.micro | 750時間（常時稼働） | $0.00 |
| AWS Lambda | 無料枠 | 数千〜数万リクエスト | $0.00 |
| AWS API Gateway | 無料枠 | 数千〜数万リクエスト | $0.00 |
| Upstash Redis | Free Plan | 数百〜数千リクエスト/日 | $0.00 |
| Vercel | Hobby | Next.jsホスティング | $0.00 |
| **合計** | - | - | **$0.00** |

**パフォーマンス:**
- ✅ レスポンスタイム: 平均200〜500ms
- ✅ 稼働率: 99.9%以上
- ✅ 同時接続: 個人利用で十分
- ✅ データ保存: 問題なし（20GB以内）

**無料枠の余裕度:**
- RDS: 750時間の上限を使い切る（常時稼働なので当然）
- Lambda: 無料枠の1%未満使用（99%以上余裕あり）
- API Gateway: 無料枠の1%未満使用
- Upstash Redis: 無料枠の10〜30%使用（70%以上余裕あり）

> **💡 結論**: このアプリは個人利用向けに設計されており、AWS無料枠で十分運用できることが実証されています。安心して使ってください！

### Q13: エラーが出て困っています

**A**: 以下の順で確認:
1. [トラブルシューティング](#-トラブルシューティング) を確認
2. ターミナルのエラーメッセージを読む
3. `.env.local` の設定を確認
4. データベースが起動しているか確認
5. サーバーを再起動
6. それでも解決しない場合は GitHub Issues で質問

### Q14: TypeScriptのエラーが出ます

**A**:
```bash
# 型エラーを無視してビルド
npm run build
```

ただし、TypeScriptを学習することをお勧めします！

---

## 🐳 Dockerでの実行（オプション）

> **📝 注意**: このアプリはAWS RDS PostgreSQLを使用するため、データベースはDockerではなくAWS RDSで管理することを推奨します。

ローカル開発環境でNext.jsアプリをDockerで動かす方法:

```bash
# アプリのみをDockerで起動（データベースはAWS RDS）
docker-compose up -d app

# ログを確認
docker-compose logs -f app

# 停止
docker-compose down
```

必要に応じて、開発用にローカルRedisを起動できます:

```bash
# ローカルRedisを起動
docker run -d -p 6379:6379 --name redis-local redis:alpine
```

---

## 🚀 Vercelへのデプロイ（本番環境）

> **🎉 アプリを世界中に公開しよう！**
>
> Vercelを使えば、あなたのTodoアプリを**無料で**インターネット上に公開できます。
> 友達や家族とシェアしたり、どこからでもアクセスできるようになります！

### Vercelって何？

**Vercel（ヴァーセル）** は、Next.jsアプリを簡単にインターネット上に公開できるサービスです。

- ✅ **完全無料**で個人プロジェクトを公開できる
- ✅ GitHubと連携して自動デプロイ
- ✅ 世界中どこからでも高速にアクセス可能
- ✅ 難しい設定は不要（初心者にやさしい）

### デプロイ前の準備チェック

デプロイする前に、以下の設定を完了させておいてください：

| 項目 | 必須？ | 説明 |
|------|--------|------|
| ✅ AWS RDS PostgreSQL | **必須** | データベース（タスクの保存場所） |
| ✅ AWS Lambda API | **必須** | 時間計測機能 |
| ⭐ GitHub/Google認証 | オプション | ソーシャルログインを使う場合 |
| ⭐ Upstash Redis | オプション | 高速化・リアルタイム同期 |

> **💡 ヒント**: 上記の設定がまだの方は、README前半の各セットアップガイドを先に完了させてください。

---

### 📝 デプロイ手順（ステップ・バイ・ステップ）

所要時間: 約20〜30分

#### ステップ1: GitHubにコードをアップロード 📤

まず、あなたのアプリのコードをGitHubに保存します。

**手順:**

1. **GitHubにログイン** → [https://github.com](https://github.com)

2. **新しいリポジトリを作成**
   - 右上の「+」をクリック → 「New repository」
   - Repository name: `my-todo-app`（好きな名前でOK）
   - **Private**（非公開）を選択（推奨）
   - 「Create repository」をクリック

3. **ローカルからGitHubにアップロード**（ターミナルで実行）
   ```bash
   # GitHubリポジトリに接続
   git remote add origin https://github.com/あなたのユーザー名/my-todo-app.git

   # コードをアップロード
   git branch -M main
   git push -u origin main
   ```

> **⚠️ 注意**: `あなたのユーザー名` の部分は、実際のGitHubユーザー名に置き換えてください。

---

#### ステップ2: Vercelアカウントを作成 ✨

Vercelのアカウントを作ります（完全無料）。

**手順:**

1. **Vercelにアクセス** → [https://vercel.com](https://vercel.com)
2. 右上の「**Sign Up**」をクリック
3. 「**Continue with GitHub**」を選択（GitHubアカウントでログイン）
4. GitHubの認証画面が表示されたら「**Authorize Vercel**」をクリック
5. プランは「**Hobby**（無料）」を選択

> **💡 なぜGitHub連携？** GitHubと連携すると、コードを更新するだけで自動的にサイトも更新されます（超便利！）

---

#### ステップ3: プロジェクトをインポート 🚢

GitHubのコードをVercelに読み込みます。

**手順:**

1. Vercelのダッシュボード画面で「**Add New...**」→「**Project**」をクリック
2. 「**Import Git Repository**」画面で、先ほど作った `my-todo-app` を探す
3. リポジトリ名の横にある「**Import**」ボタンをクリック

> **📝 補足**: リポジトリが見つからない場合は、「Adjust GitHub App Permissions」をクリックして、Vercelにアクセス権限を与えてください。

---

#### ステップ4: 環境変数を設定 🔑

アプリが動くために必要な「設定情報」を登録します。

**環境変数って何？**
データベースのパスワードやAPIキーなど、秘密にしたい情報を安全に保管する仕組みです。コードに直接書くと、誰でも見れてしまうため危険です。環境変数を使えば、安全に秘密情報を管理できます。

---

### 🎯 環境変数設定の全体像

Vercelの環境変数設定は、以下の手順で行います：

1. **Configure Project画面を開く** - プロジェクトインポート後に表示されます
2. **Environment Variablesセクションを探す** - 画面を下にスクロールすると見つかります
3. **必要な環境変数を1つずつ追加** - KEY（変数名）とVALUE（値）を入力
4. **すべて追加したらDeploy** - 設定が完了したらデプロイボタンを押します

---

### 📋 設定する環境変数リスト

> **💡 どこから値を持ってくる？**
> これらの値は、ローカル環境の `.env.local` ファイルに書いたものと**同じ値**を使います。
> テキストエディタで `.env.local` を開いて、コピー&ペーストしましょう！

#### 【必須】絶対に必要な設定 ✅

これらの環境変数がないと、アプリが正常に動作しません。必ず設定してください。

##### 1. `DATABASE_URL` - データベース接続先

**何に使う？**: AWS RDS PostgreSQLデータベースに接続するための情報です。

**値の形式:**
```
postgresql://ユーザー名:パスワード@エンドポイント:5432/データベース名
```

**実際の例:**
```
postgresql://todouser:MySecurePassword123@my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com:5432/todoapp
```

**どこで取得？**: AWS RDS作成時に設定した接続情報です。以下の値を組み合わせます：
- **ユーザー名**: RDS作成時に設定（例: `todouser`）
- **パスワード**: RDS作成時に設定（例: `MySecurePassword123`）
- **エンドポイント**: RDSダッシュボードの「接続とセキュリティ」タブに表示（例: `my-todo-db.c9akciq32.ap-northeast-1.rds.amazonaws.com`）
- **ポート**: 通常は `5432`（PostgreSQLのデフォルト）
- **データベース名**: RDS作成時に設定（例: `todoapp`）

> **⚠️ よくあるミス:**
> - スペースや改行が入っていないか確認
> - パスワードに特殊文字（`@`, `#`, `&` など）が含まれる場合は、URLエンコードが必要
> - `postgresql://` の部分を忘れないように

---

##### 2. `NEXTAUTH_URL` - あなたのサイトのURL

**何に使う？**: NextAuth（認証システム）がログイン処理を行うために必要な、あなたのアプリのURLです。

**値の形式:**
```
https://あなたのアプリ名.vercel.app
```

**実際の例:**
```
https://my-todo-app-abc123.vercel.app
```

**どこで取得？**: デプロイ後にVercelが自動的に割り当てるURLです。

> **⚠️ 重要な注意点:**
> - **最初のデプロイ時**: まだURLが決まっていないので、一旦 `https://temp.vercel.app` と入力しておきます
> - **デプロイ後**: ステップ6で正しいURLに更新します（この手順を忘れるとログインが動作しません！）

**設定手順:**
1. 最初は仮のURL `https://temp.vercel.app` を入力
2. デプロイが完了したら、Vercelが表示する実際のURLをメモ
3. 「Settings」→「Environment Variables」で `NEXTAUTH_URL` を更新
4. 再デプロイして反映

---

##### 3. `NEXTAUTH_SECRET` - ログイン用の秘密キー

**何に使う？**: ユーザーのセッション（ログイン状態）を暗号化するための秘密キーです。この値が漏れると、セキュリティリスクがあります。

**値の形式:**
```
ランダムな32文字以上の文字列
```

**実際の例:**
```
jZe8FvKl3mN2pQ4rS6tU8wX0yA1bC3dE5fG7hI9jK0lM2nO4pQ6r
```

**どこで取得？**: ターミナルでコマンドを実行して生成します。

**生成方法（Mac/Linux）:**
```bash
openssl rand -base64 32
```

**生成方法（Windows）:**
PowerShellで以下を実行:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

または、オンラインツールを使用:
- https://generate-secret.vercel.app/32

> **💡 セキュリティTips:**
> - 絶対に他人と共有しない
> - GitHubなどに公開しない
> - 定期的に変更することを推奨（変更すると全ユーザーがログアウトされます）

---

##### 4. `LAMBDA_API_URL` - Lambda APIのURL

**何に使う？**: 時間計測機能で使用するAWS Lambda関数のエンドポイントURLです。

**値の形式:**
```
https://xxxxxxxxxx.execute-api.リージョン.amazonaws.com
```

**実際の例:**
```
https://abc123def4.execute-api.ap-northeast-1.amazonaws.com
```

**どこで取得？**: AWS Lambda関数作成後、API Gatewayで確認できます。

**取得手順:**
1. AWSコンソールで「Lambda」を開く
2. 作成したLambda関数をクリック
3. 「設定」タブ→「関数URL」または「トリガー」セクションを確認
4. 表示されているURLをコピー

または、API Gatewayから取得:
1. AWSコンソールで「API Gateway」を開く
2. 作成したAPIをクリック
3. 「ステージ」→「Invoke URL」をコピー

> **⚠️ 注意:**
> - URLの末尾に `/` （スラッシュ）を付けない
> - `https://` で始まることを確認

---

##### 5. `LAMBDA_API_KEY` - Lambda APIのキー

**何に使う？**: Lambda APIへのアクセスを制限するためのAPIキーです。これがないと、誰でもあなたのAPIを使えてしまいます。

**値の形式:**
```
任意の強力なランダム文字列（推奨: 32文字以上）
```

**実際の例:**
```
your-api-key-here-32-characters-minimum
```

**どこで取得？**: 自分で生成するか、AWS API Gatewayで設定したAPIキーを使用します。

**生成方法1: 自分で生成（簡単）**
```bash
openssl rand -hex 32
```

**生成方法2: AWS API Gatewayで生成**
1. AWSコンソールで「API Gateway」を開く
2. 「APIキー」メニューをクリック
3. 「アクション」→「APIキーの作成」
4. 名前を入力（例: `my-todo-app-key`）
5. 「保存」をクリック
6. 「表示」をクリックして、APIキーをコピー

> **💡 セキュリティTips:**
> - Lambda関数側でこのAPIキーを検証する処理を実装してください
> - 定期的にAPIキーをローテーション（変更）することを推奨

---

#### 【オプション】あると便利な設定 🎨

これらの環境変数は、特定の機能を使う場合にのみ必要です。必要に応じて設定してください。

##### 6. `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN` - Redis接続情報

**何に使う？**: レート制限（アクセス制限）やキャッシュ機能を実装する場合に使用します。

**いつ必要？**:
- API呼び出しの頻度を制限したい場合
- データのキャッシュでパフォーマンスを向上させたい場合

**どこで取得？**:
1. [Upstash](https://upstash.com/) でアカウント作成
2. 「Redis」→「Create Database」でデータベースを作成
3. ダッシュボードの「REST API」タブで以下を確認:
   - `UPSTASH_REDIS_REST_URL`: `https://xxxxx.upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN`: `AXXXxxxXXXxxx`

**設定例:**
```env
UPSTASH_REDIS_REST_URL="https://guided-bass-12345.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AYABCDxxxxxxxxxxxxxxxxxxxxxx"
```

> **💡 無料枠**: Upstashは1日10,000コマンドまで無料です。

---

##### 7. `GITHUB_ID` & `GITHUB_SECRET` - GitHub OAuth認証

**何に使う？**: GitHubアカウントでログインできるようにします。

**いつ必要？**: GitHubログイン機能を使いたい場合

**どこで取得？**:
1. [GitHub Developer Settings](https://github.com/settings/developers) を開く
2. 「OAuth Apps」→「New OAuth App」をクリック
3. 以下を入力:
   - **Application name**: `My Todo App`
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/callback/github`
4. 「Register application」をクリック
5. **Client ID** と **Client Secret** をコピー

**設定例:**
```env
GITHUB_ID="Iv1.1234567890abcdef"
GITHUB_SECRET="1234567890abcdef1234567890abcdef12345678"
```

> **⚠️ 重要**: デプロイ後、実際のVercel URLで再度設定してください。

---

##### 8. `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` - Google OAuth認証

**何に使う？**: Googleアカウントでログインできるようにします。

**いつ必要？**: Googleログイン機能を使いたい場合

**どこで取得？**:
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」
3. 「同意画面を構成」で必要情報を入力
4. アプリケーションの種類: 「ウェブアプリケーション」
5. 承認済みのリダイレクトURI: `https://your-app.vercel.app/api/auth/callback/google`
6. **クライアントID** と **クライアントシークレット** をコピー

**設定例:**
```env
GOOGLE_CLIENT_ID="123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcdefghijklmnopqrstuvwx"
```

---

### 🛠️ 環境変数の追加方法（実際の操作手順）

VercelのConfigure Project画面で、以下の手順を繰り返して、すべての環境変数を追加します。

#### ステップ1: Environment Variablesセクションを探す

1. プロジェクトインポート後の「Configure Project」画面を開く
2. 画面を下にスクロール
3. 「**Environment Variables**」というセクションを見つける

#### ステップ2: 環境変数を1つずつ追加

各環境変数について、以下を繰り返します：

1. **Name（左側の入力欄）**: 変数名を入力（例: `DATABASE_URL`）
   - 大文字・小文字を正確に入力してください
   - スペースは入れないでください

2. **Value（右側の入力欄）**: 値を入力（例: `postgresql://...`）
   - `.env.local` ファイルからコピー&ペーストすると安全です
   - 先頭・末尾にスペースや改行が入らないように注意

3. **Environment**: デフォルトで「Production, Preview, Development」がすべて選択されています
   - そのままでOKです（全環境で同じ値を使用）
   - 必要に応じて特定の環境のみ選択できます

4. **Add**ボタンをクリック
   - 環境変数が追加されます
   - 追加された変数は画面上部のリストに表示されます

#### ステップ3: すべての環境変数を確認

すべての必須環境変数を追加したら、以下を確認：

- ✅ `DATABASE_URL` - 追加済み
- ✅ `NEXTAUTH_URL` - 追加済み（仮のURLでOK）
- ✅ `NEXTAUTH_SECRET` - 追加済み
- ✅ `LAMBDA_API_URL` - 追加済み
- ✅ `LAMBDA_API_KEY` - 追加済み
- ✅ オプション変数（必要に応じて）

#### ステップ4: デプロイ準備完了

すべての環境変数を追加したら、画面下部の「**Deploy**」ボタンをクリックできるようになります。

---

### 🔍 よくあるトラブルと解決方法

#### ❌ エラー: "Missing environment variable: DATABASE_URL"

**原因**: 環境変数が設定されていない、または名前が間違っている

**解決方法**:
1. Vercelの「Settings」→「Environment Variables」を開く
2. `DATABASE_URL` が存在するか確認
3. 変数名のスペルが正確か確認（大文字・小文字も一致させる）
4. 再デプロイを実行

#### ❌ エラー: "Database connection failed"

**原因**: `DATABASE_URL` の値が間違っている

**解決方法**:
1. `.env.local` の `DATABASE_URL` をコピー
2. ローカルで正常に接続できるか確認（`npm run dev` で動作確認）
3. Vercelの環境変数に正確にコピー&ペースト
4. スペースや改行が入っていないか確認
5. AWS RDSのセキュリティグループで、すべてのIP（`0.0.0.0/0`）を許可しているか確認

#### ❌ エラー: "Callback URL mismatch"

**原因**: `NEXTAUTH_URL` が実際のURLと一致していない

**解決方法**:
1. デプロイ後の実際のURLを確認（例: `https://my-todo-app-abc123.vercel.app`）
2. 「Settings」→「Environment Variables」で `NEXTAUTH_URL` を更新
3. 再デプロイを実行

#### 💡 環境変数が反映されない場合

環境変数を追加・変更した後は、**必ず再デプロイ**が必要です。

**再デプロイ方法**:
1. Vercelプロジェクトページで「Deployments」タブを開く
2. 最新のデプロイの右側にある「**...**」メニューをクリック
3. 「**Redeploy**」を選択
4. 「**Redeploy**」ボタンをクリックして確認

---

### 📝 環境変数管理のベストプラクティス

1. **セキュリティ**
   - ✅ 環境変数は絶対にGitHubにコミットしない
   - ✅ `.env.local` が `.gitignore` に含まれているか確認
   - ✅ APIキーやシークレットは定期的に変更

2. **管理**
   - ✅ `.env.example` ファイルで必要な変数をドキュメント化
   - ✅ チームメンバーには直接値を共有せず、設定方法を共有
   - ✅ 環境ごとに異なる値が必要な場合は、Vercelの環境設定を活用

3. **トラブルシューティング**
   - ✅ 変更後は必ず再デプロイ
   - ✅ Vercelのログで環境変数のエラーを確認
   - ✅ ローカル環境で先にテストしてから本番環境に適用

---

### 📚 参考リンク

- [Vercel Environment Variables公式ドキュメント](https://vercel.com/docs/concepts/projects/environment-variables)
- [NextAuth.js環境変数設定](https://next-auth.js.org/configuration/options#environment-variables)
- [AWS RDS接続文字列フォーマット](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)

---

#### ステップ5: いよいよデプロイ！ 🚀

すべての設定が完了したら、デプロイボタンを押します。

**手順:**

1. 画面下部の「**Deploy**」ボタンをクリック
2. ビルドが始まります（2〜5分ほど待ちます）
   - 画面に進捗ログが表示されます
   - 「Building...」→「Deploying...」と進みます
3. 「**Congratulations!**」と表示されたら成功！
4. あなた専用のURLが表示されます
   - 例: `https://my-todo-app-abc123.vercel.app`

> **🎉 おめでとうございます！** アプリがインターネット上に公開されました！

---

#### ステップ6: NEXTAUTH_URLを更新 🔧

先ほど仮で設定した `NEXTAUTH_URL` を、正しいURLに変更します。

**手順:**

1. Vercelのプロジェクトページで「**Settings**」タブをクリック
2. 左メニューから「**Environment Variables**」を選択
3. `NEXTAUTH_URL` の右側にある「**Edit**」をクリック
4. 値を実際のURL（`https://my-todo-app-abc123.vercel.app`）に変更
5. 「**Save**」をクリック
6. 右上の「**Deployments**」タブ → 最新のデプロイの「**・・・**」→「**Redeploy**」で再デプロイ

> **💡 なぜ必要？** 正しいURLを設定しないと、ログイン機能が正常に動作しません。

---

#### ステップ7: データベースの準備（初回のみ） 🗄️

データベースにテーブルを作成します。

**手順（ターミナルで実行）:**

```bash
# 本番データベースに接続してテーブル作成
DATABASE_URL="あなたのDATABASE_URL" npx prisma db push
```

> **📝 補足**: `あなたのDATABASE_URL` には、`.env.local` に書いた `DATABASE_URL` の値をそのまま貼り付けます。

実行すると以下のように表示されます:
```
✔ Your database is now in sync with your Prisma schema. Done in XXXms
```

---

#### ステップ8: GitHubログイン/Googleログインの設定更新（使う場合のみ） 🔑

GitHub/Googleログインを使う場合は、Callback URLを更新します。

##### GitHub OAuth の場合

1. [GitHub Developer Settings](https://github.com/settings/developers) を開く
2. 作成した OAuth App をクリック
3. 「**Authorization callback URL**」に以下を**追加**:
   ```
   https://あなたのアプリURL/api/auth/callback/github
   ```
   例: `https://my-todo-app-abc123.vercel.app/api/auth/callback/github`
4. 「**Update application**」をクリック

##### Google OAuth の場合

1. [Google Cloud Console](https://console.cloud.google.com/) を開く
2. プロジェクトを選択 → 「**APIとサービス**」→「**認証情報**」
3. 作成した OAuth 2.0 クライアント ID をクリック
4. 「**承認済みのリダイレクト URI**」に以下を**追加**:
   ```
   https://あなたのアプリURL/api/auth/callback/google
   ```
   例: `https://my-todo-app-abc123.vercel.app/api/auth/callback/google`
5. 「**保存**」をクリック

---

### 🎊 完成！動作確認しよう

以下を確認してください：

- ✅ デプロイされたURL（`https://あなたのアプリ.vercel.app`）にアクセスできる
- ✅ サインアップ/サインインができる
- ✅ タスクを作成・編集・削除できる
- ✅ 時間計測機能が動作する

**問題があった場合は、下の「トラブルシューティング」セクションを確認してください。**

---

### 🌐 独自ドメインを使いたい場合（オプション・上級者向け）

`my-todo-app.vercel.app` ではなく、`todo.example.com` のような独自ドメインを使いたい場合。

**必要なもの:**
- 自分で購入したドメイン（お名前.com、Cloudflareなどで購入）

**手順:**

1. Vercelプロジェクトで「**Settings**」→「**Domains**」を開く
2. 「**Add Domain**」をクリック
3. 購入したドメイン名を入力（例: `todo.example.com`）
4. Vercelが表示する DNS レコードをメモ
5. ドメイン購入サイト（お名前.com等）でDNS設定を追加
6. 数分〜数時間で反映されます

> **⚠️ 注意**: 独自ドメインを設定したら、OAuth の Callback URL も更新が必要です！

---

### 🔄 コードを更新したらどうなる？（自動デプロイ）

Vercelの素晴らしい機能の一つが**自動デプロイ**です。

**仕組み:**

1. ローカルでコードを修正
2. GitHubにプッシュ
3. **自動的にVercelが検知して再デプロイ！**

```bash
# 例: 新機能を追加した場合
git add .
git commit -m "新しい機能を追加"
git push origin main

# → 数分後、自動的にサイトに反映される！
```

**プレビュー機能も便利！**

mainブランチ以外にプッシュすると、プレビュー用URLが自動生成されます:

```bash
# 開発ブランチで作業
git checkout -b feature/new-feature
git add .
git commit -m "実験的な機能"
git push origin feature/new-feature

# → Vercelが自動的にプレビュー環境を作成
# → 例: https://my-todo-app-abc123-preview.vercel.app
```

これで、本番環境に影響を与えずにテストできます！

---

### 🆘 よくあるエラーと解決方法（トラブルシューティング）

デプロイ時に問題が発生した場合は、以下を確認してください。

#### ❌ エラー: "Build failed - Type errors found"

**何が起きた？**
TypeScriptの型エラーがあるため、ビルドに失敗しました。

**解決方法:**

```bash
# ローカルで型チェックを実行してエラーを確認
npm run type-check

# エラーを修正してから、GitHubにプッシュ
git add .
git commit -m "型エラーを修正"
git push origin main
```

---

#### ❌ エラー: "Prisma Client not generated"

**何が起きた？**
Prismaクライアントが生成されていないため、データベースに接続できません。

**解決方法:**

`package.json` を開いて、以下を追加します:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

その後、再度GitHubにプッシュ:

```bash
git add package.json
git commit -m "Prisma自動生成を追加"
git push origin main
```

---

#### ❌ エラー: "Database connection error"

**何が起きた？**
データベース（AWS RDS）に接続できません。

**確認ポイント:**

1. **環境変数を確認**
   - Vercelの「Settings」→「Environment Variables」を開く
   - `DATABASE_URL` が正しくコピペされているか確認（スペースや改行が入っていないか）

2. **AWS RDSのセキュリティグループを確認**
   - AWSコンソールでRDSのセキュリティグループを開く
   - インバウンドルールで「すべてのIP（0.0.0.0/0）」を許可しているか確認
   - ポート5432が開いているか確認

3. **再デプロイ**
   - 環境変数を修正したら、Vercelで再デプロイを実行

---

#### ❌ エラー: "Sign in error - Callback URL mismatch"

**何が起きた？**
GitHubログインまたはGoogleログインのCallback URLが間違っています。

**解決方法:**

1. **`NEXTAUTH_URL` を確認**
   - Vercelの環境変数で、`NEXTAUTH_URL` が正しいURL（例: `https://my-todo-app-abc123.vercel.app`）になっているか確認

2. **GitHub/Google側のCallback URLを確認**
   - GitHub: `https://あなたのアプリURL/api/auth/callback/github`
   - Google: `https://あなたのアプリURL/api/auth/callback/google`
   - 上記が正しく設定されているか確認

3. **再デプロイ**

---

#### ❌ サイトにアクセスできない（500エラー）

**何が起きた？**
サーバーエラーが発生しています。

**解決方法:**

1. **Vercelのログを確認**
   - Vercelプロジェクトで「Deployments」→最新のデプロイをクリック
   - 「Function Logs」でエラー内容を確認

2. **よくある原因**
   - 環境変数が設定されていない
   - データベースマイグレーション（`npx prisma db push`）を実行していない
   - Lambda APIが動いていない

---

#### 💡 それでも解決しない場合

1. Vercelの「Deployments」タブでビルドログを確認
2. エラーメッセージをコピーしてGoogle検索
3. GitHubのIssuesで質問（他の人も同じ問題に遭遇しているかも）

### 💰 料金について（重要！）

**Vercel無料プラン（Hobby）でできること:**

| 項目 | 無料枠 | 超えた場合 |
|------|--------|------------|
| プロジェクト数 | 無制限 | - |
| 帯域幅（通信量） | 100GB/月 | 個人利用なら十分 |
| ビルド時間 | 100時間/月 | 個人利用なら十分 |
| 商用利用 | ❌ 不可 | Proプラン（$20/月）が必要 |

**全体の月間コスト試算:**

| サービス | 1年目（無料枠） | 2年目以降 |
|---------|----------------|-----------|
| Vercel | **$0** | **$0** |
| AWS RDS PostgreSQL | **$0** | $10〜15/月 |
| AWS Lambda | **$0** | **$0**（軽い使用なら） |
| **合計** | **完全無料！** | $10〜15/月 |

> **💡 ポイント**: 個人で趣味として使う分には、1年間は完全無料！その後もとても安い！

---

### 🔒 セキュリティ上の注意点

デプロイした後は、以下に気をつけてください：

#### 1. 秘密情報を守る

- ❌ **絶対にやってはいけないこと**:
  - `.env.local` ファイルをGitHubにアップロード
  - データベースのパスワードをコードに直接書く
  - APIキーを公開リポジトリにコミット

- ✅ **正しい方法**:
  - 秘密情報は必ずVercelの「Environment Variables」で管理
  - `.gitignore` に `.env.local` が含まれているか確認

#### 2. データベースのセキュリティ

- ✅ AWS RDSで強力なパスワードを使う
- ✅ 定期的にバックアップを取る（RDSの自動バックアップを有効化）

#### 3. 定期的にチェックすること

- ✅ AWS予算アラートを設定（無料枠を超えたら通知）
- ✅ 月に1回、AWSの請求画面を確認
- ✅ Vercelの使用量を確認（ダッシュボードで見られます）

---

### 📊 パフォーマンス・監視のヒント

**Vercelで確認できること:**

1. **Analytics（分析）**
   - どれだけの人がアクセスしたか
   - ページの読み込み速度
   - どのページが人気か

2. **Deployment Logs（デプロイログ）**
   - ビルドが成功したか
   - エラーがあったか

**AWSで確認できること:**

1. **CloudWatch（ログ・監視）**
   - Lambda関数の実行回数
   - データベースの接続数
   - エラーログ

2. **Billing（請求）**
   - 今月いくら使っているか
   - 無料枠をどれだけ消費しているか

> **💡 おすすめ**: 月に1回、これらを確認する習慣をつけましょう！

---

### 📚 まとめ: Vercelデプロイの全体像

**やったこと:**
1. ✅ GitHubにコードをアップロード
2. ✅ Vercelアカウントを作成
3. ✅ プロジェクトをインポート
4. ✅ 環境変数を設定
5. ✅ デプロイボタンをクリック
6. ✅ NEXTAUTH_URLを更新
7. ✅ データベースをセットアップ
8. ✅ OAuthのCallback URLを更新

**結果:**
- 🌐 あなたのTodoアプリが世界中からアクセス可能に！
- 🔄 コードを更新したら自動的にデプロイされる
- 💰 1年間は完全無料で運用できる

**これからできること:**
- 友達や家族とURLを共有
- どこからでもアクセスしてタスク管理
- ポートフォリオとして履歴書に載せる
- 継続的に機能を追加していく

> **🎊 お疲れ様でした！** あなたは今、立派なフルスタック開発者です！

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
2. GitHub Issuesで質問（リポジトリの「Issues」タブから）
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
