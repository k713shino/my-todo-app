/**
 * Lambda関数サンプルコード - 時間計測API
 *
 * ✅ セキュリティ監査済み:
 * このファイルには以下の機密情報は含まれていません：
 * - ハードコードされたパスワード
 * - データベース接続文字列
 * - APIキーやトークン
 * - AWS認証情報
 * - その他の機密情報
 *
 * すべての機密情報は環境変数またはAWS Secrets Managerから取得する設計になっています。
 *
 * ⚠️ セキュリティに関する重要な注意事項:
 *
 * このファイルはサンプル実装です。本番環境で使用する前に、以下のセキュリティ対策を必ず実装してください:
 *
 * 1. 認証・認可:
 *    - API GatewayでのJWT認証またはCognito認証の実装
 *    - リクエストごとのユーザー検証
 *    - CORS設定の厳格化
 *
 * 2. 機密情報管理:
 *    - AWS Secrets Manager または Systems Manager Parameter Store を使用
 *    - 環境変数に直接機密情報を含めない
 *    - ログに機密情報を出力しない
 *
 * 3. データベースセキュリティ:
 *    - 最小権限の原則に基づいたIAMロールとDB権限設定
 *    - VPC内でのLambda実行（パブリックインターネットアクセス禁止）
 *    - SSL/TLS接続の強制
 *    - 接続プールの適切な管理
 *
 * 4. 入力検証:
 *    - すべてのユーザー入力に対するバリデーション
 *    - SQLインジェクション対策（パラメータ化クエリ）
 *    - XSS対策
 *
 * 5. レート制限:
 *    - API Gatewayでのレート制限設定
 *    - ログイン試行回数の制限
 *    - アカウントロックアウト機能
 *
 * 6. 監視・ログ:
 *    - CloudWatch Logsでの詳細なログ記録
 *    - 異常なアクセスパターンの検知
 *    - アラート設定
 *
 * 7. bcryptパラメータ:
 *    - salt rounds: 環境変数で管理（推奨値: 10-14）
 *    - パスワードポリシーの強化
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { createOptimizedPgConfig } = require('./ssl-optimized-pg');

let pool = null;

// PostgreSQL接続プールの初期化
// セキュリティ注意: 本番環境では以下を実装してください:
// 1. 環境変数からの接続情報読み込み
// 2. AWS Secrets Manager または類似のシークレット管理サービス使用
// 3. 最小権限の原則に基づいたデータベースユーザー権限設定
// 4. VPC内でのLambda実行（プライベートサブネット）
async function initializeDbPool() {
    if (!pool) {
        const config = await createOptimizedPgConfig();
        pool = new Pool(config);

        // ログ出力時は機密情報をマスクする
        console.log('📊 Optimized PostgreSQL pool configuration loaded:', {
            host: config.host ? '✓' : '✗',
            port: config.port,
            user: config.user ? '✓' : '✗',
            database: config.database ? '✓' : '✗',
            ssl: config.ssl ? '✓ enabled' : '✗ disabled',
            sslMode: process.env.SSL_MODE || 'basic',
            maxConnections: config.max
        });
    }
    return pool;
}

// データベース接続関数
async function connectToDatabase() {
    console.log('🔌 Getting PostgreSQL connection from pool...');
    try {
        const dbPool = await initializeDbPool();
        const client = await dbPool.connect();
        console.log('✅ PostgreSQL connection established');
        return client;
    } catch (error) {
        console.error('❌ PostgreSQL connection failed:', error.message);
        throw error;
    }
}

// データベーススキーマの確認と作成
async function ensureDatabaseSchema() {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔍 データベーススキーマの確認中...');
        
        // 既存テーブルの確認
        const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        const existingTables = tablesResult.rows.map(row => row.table_name);
        console.log('📋 既存テーブル:', existingTables);
        
        // Userテーブルが存在しない場合は作成 (OAuth対応)
        if (!existingTables.includes('User')) {
            console.log('🔨 Userテーブルを作成中...');
            await client.query(`
                CREATE TABLE "User" (
                    id TEXT PRIMARY KEY,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255),
                    name VARCHAR(255),
                    "emailVerified" TIMESTAMPTZ,
                    image TEXT,
                    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log('✅ Userテーブル作成完了 (OAuth対応)');
        }
        
        // Todoテーブルが存在しない場合は作成 (OAuth対応)
        if (!existingTables.includes('Todo')) {
            console.log('🔨 Todoテーブルを作成中...');
            await client.query(`
                CREATE TABLE "Todo" (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    completed BOOLEAN DEFAULT FALSE,
                    priority VARCHAR(20) DEFAULT 'medium',
                    category VARCHAR(100),
                    tags TEXT,
                    "dueDate" TIMESTAMPTZ,
                    "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
                    "parentId" INTEGER REFERENCES "Todo"(id) ON DELETE CASCADE,
                    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log('✅ Todoテーブル作成完了 (OAuth対応)');
        }
        
        // TimeEntryテーブルが存在しない場合は作成 (時間追跡機能)
        if (!existingTables.includes('TimeEntry')) {
            console.log('🔨 TimeEntryテーブルを作成中...');
            await client.query(`
                CREATE TABLE "TimeEntry" (
                    id SERIAL PRIMARY KEY,
                    "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
                    "todoId" INTEGER REFERENCES "Todo"(id) ON DELETE SET NULL,
                    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    "endedAt" TIMESTAMPTZ,
                    duration INTEGER, -- 秒数
                    description TEXT,
                    category VARCHAR(100),
                    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log('✅ TimeEntryテーブル作成完了');
            
            // インデックス作成
            await client.query(`
                CREATE INDEX IF NOT EXISTS "idx_time_entry_user" ON "TimeEntry"("userId");
                CREATE INDEX IF NOT EXISTS "idx_time_entry_todo" ON "TimeEntry"("todoId");
                CREATE INDEX IF NOT EXISTS "idx_time_entry_started" ON "TimeEntry"("startedAt");
                CREATE INDEX IF NOT EXISTS "idx_time_entry_active" ON "TimeEntry"("userId") WHERE "endedAt" IS NULL;
            `);
            console.log('✅ TimeEntryインデックス作成完了');
        }
        
        // TimeGoalテーブルが存在しない場合は作成 (時間目標設定)
        if (!existingTables.includes('TimeGoal')) {
            console.log('🔨 TimeGoalテーブルを作成中...');
            await client.query(`
                CREATE TABLE "TimeGoal" (
                    id SERIAL PRIMARY KEY,
                    "userId" TEXT UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
                    "dailyGoal" INTEGER DEFAULT 480, -- 分単位
                    "weeklyGoal" INTEGER DEFAULT 2400, -- 分単位
                    "monthlyGoal" INTEGER DEFAULT 10080, -- 分単位
                    "dailyReminder" BOOLEAN DEFAULT TRUE,
                    "progressAlert" BOOLEAN DEFAULT TRUE,
                    "goalAchieved" BOOLEAN DEFAULT TRUE,
                    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
                )
            `);
            console.log('✅ TimeGoalテーブル作成完了');
        }
        
        // 🔧 既存テーブルのスキーマ更新 (OAuth対応) - 強制実行
        try {
            // 1. 外部キー制約削除
            console.log('🔄 外部キー制約削除中...');
            await client.query('ALTER TABLE "Todo" DROP CONSTRAINT IF EXISTS "Todo_userId_fkey"');
            
            // 2. Userテーブルのid列をTEXT型に変更
            console.log('🔄 Userテーブルのid列をTEXT型に変更中...');
            await client.query('ALTER TABLE "User" ALTER COLUMN id TYPE TEXT');
            await client.query('ALTER TABLE "User" ALTER COLUMN password DROP NOT NULL');
            
            // 3. TodoテーブルのuserId列をTEXT型に変更
            console.log('🔄 TodoテーブルのuserId列をTEXT型に変更中...');
            await client.query('ALTER TABLE "Todo" ALTER COLUMN "userId" TYPE TEXT');
            
            // 4. Todoテーブルにtagsカラムを追加（存在しない場合）
            console.log('🔄 Todoテーブルにtagsカラム追加中...');
            await client.query('ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS tags TEXT');
            
            // 4.5. Todoテーブルにstatusカラムを追加（4ステータス対応）
            console.log('🔄 Todoテーブルにstatusカラム追加中...');
            await client.query(`
                ALTER TABLE "Todo" 
                ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'TODO' 
                CHECK (status IN ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'))
            `);
            
            // 4.6. TodoテーブルにparentIdカラムを追加（サブタスク対応）
            console.log('🔄 TodoテーブルにparentIdカラム追加中...');
            await client.query(`
                ALTER TABLE "Todo" 
                ADD COLUMN IF NOT EXISTS "parentId" INTEGER REFERENCES "Todo"(id) ON DELETE CASCADE
            `);
            
            // 既存レコードでstatusがNULLの場合、completedから推測して設定
            console.log('🔄 既存レコードのstatus初期化中...');
            await client.query(`
                UPDATE "Todo" 
                SET status = CASE 
                    WHEN completed = true THEN 'DONE'
                    ELSE 'TODO'
                END
                WHERE status IS NULL
            `);
            
            // 5. 外部キー制約を再追加
            console.log('🔄 外部キー制約再追加中...');
            await client.query('ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE');
            
            console.log('✅ OAuth対応スキーマ強制更新完了');
        } catch (schemaError) {
            console.log('⚠️ スキーマ更新エラー:', schemaError.message);
            // エラーがあってもスキーマ作成は続行
        }
        
        // 最新のテーブル一覧を再取得
        const finalTablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);
        
        const finalTables = finalTablesResult.rows.map(row => row.table_name);
        
        return {
            success: true,
            data: {
                existing_tables: existingTables,
                final_tables: finalTables,
                created_tables: finalTables.filter(t => !existingTables.includes(t))
            },
            message: 'Database schema check and creation completed'
        };
        
    } catch (error) {
        console.error('❌ Database schema operation failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Database schema operation failed'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// データベース接続テスト
async function testDatabaseConnection() {
    const startTime = Date.now();
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        // 基本テストクエリ
        const basicTestResult = await client.query(`
            SELECT 
                1 as test, 
                NOW() as timestamp, 
                version() as postgres_version
        `);
        
        // SSL状態の詳細確認
        const sslStatusResult = await client.query(`
            SELECT 
                CASE 
                    WHEN ssl = true THEN 'enabled'
                    ELSE 'disabled'
                END as ssl_status,
                CASE 
                    WHEN ssl = true THEN cipher
                    ELSE 'N/A'
                END as ssl_cipher,
                CASE 
                    WHEN ssl = true THEN version
                    ELSE 'N/A'
                END as ssl_version
            FROM pg_stat_ssl 
            WHERE pid = pg_backend_pid()
        `);
        
        // 接続時間計測
        const connectionTime = Date.now() - startTime;
        
        const testResult = {
            ...basicTestResult.rows[0],
            connection_time_ms: connectionTime,
            ssl_info: sslStatusResult.rows[0] || { ssl_status: 'unknown' }
        };
        
        console.log('✅ Enhanced PostgreSQL test successful:', testResult);
        
        return {
            success: true,
            data: testResult,
            message: 'PostgreSQL connection successful with SSL verification',
            performance: {
                connection_time_ms: connectionTime,
                ssl_enabled: sslStatusResult.rows[0]?.ssl_status === 'enabled'
            }
        };
    } catch (error) {
        console.error('❌ PostgreSQL test failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'PostgreSQL connection failed',
            performance: {
                connection_time_ms: Date.now() - startTime,
                ssl_enabled: false
            }
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// ユーザー登録関数
// セキュリティ注意:
// - 入力検証: メールアドレス形式、パスワード強度チェックを実装してください
// - レート制限: アカウント作成の回数制限を実装してください
// - パスワードポリシー: 最小長、複雑さ要件を設定してください
async function registerUser(userData) {
    const { email, password, name } = userData;
    let client = null;

    // TODO: 入力バリデーション
    // - メールアドレス形式の検証
    // - パスワード強度の検証（最小8文字、大小英数字と記号を含む等）
    // - XSS対策のためのサニタイズ

    try {
        client = await connectToDatabase();

        // 既存ユーザーチェック
        // 注意: パラメータ化クエリ($1)を使用してSQLインジェクション対策
        const existingUserResult = await client.query(
            'SELECT id, email FROM "User" WHERE email = $1',
            [email]
        );
        
        if (existingUserResult.rows.length > 0) {
            return {
                success: false,
                error: 'User with this email already exists'
            };
        }
        
        // パスワードハッシュ化
        // セキュリティ上の理由により、salt roundsは環境変数またはシークレット管理で設定してください
        const saltRounds = process.env.BCRYPT_SALT_ROUNDS || 10; // 推奨: 10-14
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // ユーザー作成
        const createUserResult = await client.query(
            'INSERT INTO "User" (email, password, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, email, name, "createdAt"',
            [email, hashedPassword, name || null]
        );
        
        const newUser = createUserResult.rows[0];
        console.log('✅ User registered successfully:', newUser);
        
        return {
            success: true,
            data: newUser,
            message: 'User registered successfully'
        };
        
    } catch (error) {
        console.error('❌ User registration failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// ユーザーログイン関数
// セキュリティ注意:
// - レート制限: ログイン試行回数の制限（例: 5回失敗で15分ロック）
// - アカウントロックアウト: 連続失敗時のアカウント一時ロック
// - 監査ログ: すべてのログイン試行を記録
// - タイミング攻撃対策: 成功/失敗の応答時間を同じにする
async function loginUser(credentials) {
    const { email, password } = credentials;
    let client = null;

    // TODO: レート制限チェック
    // - Redisまたはデータベースで失敗回数をカウント
    // - 閾値を超えた場合はエラーを返す

    try {
        client = await connectToDatabase();

        // セキュリティ: ログには機密情報（パスワード等）を含めない
        console.log('🔍 ログイン試行:', { email });

        // ユーザー検索
        // 注意: パラメータ化クエリ($1)を使用してSQLインジェクション対策
        const userResult = await client.query(
            'SELECT id, email, password, name, image, "createdAt" FROM "User" WHERE email = $1',
            [email]
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません:', email);
            return {
                success: false,
                error: 'Invalid email or password'
            };
        }
        
        const user = userResult.rows[0];
        
        // パスワード検証
        // 注意: 本番環境では、レート制限やアカウントロックアウト機能を実装してください
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            console.log('❌ パスワードが間違っています:', email);
            // セキュリティ上の理由により、具体的なエラー内容は返さない
            return {
                success: false,
                error: 'Invalid email or password'
            };
        }
        
        console.log('✅ ログイン成功:', { email, userId: user.id });
        
        // パスワードを除外してユーザー情報を返す
        const { password: _, ...userWithoutPassword } = user;
        
        return {
            success: true,
            data: {
                user: userWithoutPassword
            },
            message: 'Login successful'
        };
        
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        return {
            success: false,
            error: 'Internal server error'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// TODO関連操作
async function getTodos(userId = null) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        let query = 'SELECT id, title, description, completed, status, priority, category, tags, "dueDate", "userId", "parentId", "createdAt", "updatedAt" FROM "Todo"';
        let params = [];
        
        if (userId) {
            query += ' WHERE "userId" = $1';
            params.push(userId);
        }
        
        query += ' ORDER BY "createdAt" DESC';
        
        const result = await client.query(query, params);
        const todos = result.rows;
        
        // タグデータを配列に変換
        const todosWithArrayTags = todos.map(todo => ({
            ...todo,
            tags: todo.tags ? todo.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        }));
        
        console.log(`✅ Retrieved ${todosWithArrayTags.length} todos${userId ? ` for user ${userId}` : ''}`);
        
        return {
            success: true,
            data: todosWithArrayTags,
            message: `Retrieved ${todosWithArrayTags.length} todos`
        };
        
    } catch (error) {
        console.error('❌ Failed to get todos:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function createTodo(todoData) {
    const { title, description, priority, category, dueDate, userId, userEmail, userName, status, tags, parentId } = todoData;
    let client = null;
    
    // タグ配列をデータベース用の文字列に変換
    const tagsString = tags && Array.isArray(tags) ? tags.join(',') : tags;
    
    try {
        client = await connectToDatabase();
        
        // 🔧 外部キー制約エラー対策: ユーザーが存在しない場合は自動作成
        // 4ステータス対応: statusとcompletedの両方を設定
        const todoStatus = status || 'TODO';
        const completed = todoStatus === 'DONE';
        
        console.log('📊 4ステータス Todo作成:', { 
            status: todoStatus, 
            completed 
        });
        
        try {
            const result = await client.query(
                'INSERT INTO "Todo" (title, description, priority, category, "dueDate", "userId", tags, status, completed, "parentId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *',
                [title, description || null, priority || 'medium', category || null, dueDate || null, userId, tagsString || null, todoStatus, completed, parentId || null]
            );
            
            const newTodo = result.rows[0];
            // タグを配列に変換
            const todoWithArrayTags = {
                ...newTodo,
                tags: newTodo.tags ? newTodo.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
            };
            console.log('✅ Todo created successfully:', todoWithArrayTags);
            
            return {
                success: true,
                data: todoWithArrayTags,
                message: 'Todo created successfully'
            };
        } catch (fkError) {
            // 外部キー制約エラーの場合はユーザーを自動作成
            if (fkError.message.includes('violates foreign key constraint')) {
                console.log('⚠️ ユーザーが存在しません。OAuth認証ユーザーを自動作成中...', { userId, userEmail, userName });
                
                try {
                    // ユーザーを自動作成
                    await client.query(
                        'INSERT INTO "User" (id, email, name, password, "createdAt", "updatedAt") VALUES ($1, $2, $3, NULL, NOW(), NOW())',
                        [userId, userEmail || 'oauth-user@example.com', userName || 'OAuth User']
                    );
                    
                    console.log('✅ OAuth認証ユーザー自動作成完了:', { userId, userEmail, userName });
                    
                    // 再度Todo作成を試行 (4ステータス対応)
                    const retryResult = await client.query(
                        'INSERT INTO "Todo" (title, description, priority, category, "dueDate", "userId", tags, status, completed, "parentId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *',
                        [title, description || null, priority || 'medium', category || null, dueDate || null, userId, tagsString || null, todoStatus, completed, parentId || null]
                    );
                    
                    const newTodo = retryResult.rows[0];
                    // タグを配列に変換
                    const todoWithArrayTags = {
                        ...newTodo,
                        tags: newTodo.tags ? newTodo.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
                    };
                    console.log('✅ Todo created successfully after user creation:', todoWithArrayTags);
                    
                    return {
                        success: true,
                        data: todoWithArrayTags,
                        message: 'Todo created successfully with auto-created OAuth user'
                    };
                } catch (userCreateError) {
                    console.error('❌ OAuth認証ユーザー自動作成失敗:', userCreateError.message);
                    throw fkError; // 元のエラーを再スロー
                }
            } else {
                throw fkError; // 外部キー制約エラー以外は再スロー
            }
        }
        
    } catch (error) {
        console.error('❌ Todo creation failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function updateTodo(todoId, todoData, userId) {
    const { title, description, priority, category, dueDate, completed, status, tags, parentId } = todoData;
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔄 Todo更新試行:', { todoId, userId, data: todoData });
        
        // まず、Todoが存在し、ユーザーがオーナーであることを確認
        const existingTodoResult = await client.query(
            'SELECT * FROM "Todo" WHERE id = $1 AND "userId" = $2',
            [todoId, userId]
        );
        
        if (existingTodoResult.rows.length === 0) {
            console.log('❌ Todo not found or access denied:', { todoId, userId });
            return {
                success: false,
                error: 'Todo not found or access denied'
            };
        }
        
        const existingTodo = existingTodoResult.rows[0];
        
        // 更新可能なフィールドのみを更新
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 3; // id と userId が $1, $2
        
        if (title !== undefined) {
            updateFields.push(`title = $${paramIndex++}`);
            updateValues.push(title);
        }
        
        if (description !== undefined) {
            updateFields.push(`description = $${paramIndex++}`);
            updateValues.push(description);
        }
        
        if (priority !== undefined) {
            updateFields.push(`priority = $${paramIndex++}`);
            updateValues.push(priority);
        }
        
        if (category !== undefined) {
            updateFields.push(`category = $${paramIndex++}`);
            updateValues.push(category);
        }
        
        if (dueDate !== undefined) {
            updateFields.push(`"dueDate" = $${paramIndex++}`);
            updateValues.push(dueDate);
        }
        
        // 4ステータス対応: statusフィールドの処理（completedは自動的に同期）
        if (status !== undefined) {
            // statusが有効な値かチェック
            const validStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
            if (validStatuses.includes(status)) {
                updateFields.push(`status = $${paramIndex++}`);
                updateValues.push(status);
                
                // statusに基づいてcompletedを自動設定（重複回避）
                updateFields.push(`completed = $${paramIndex++}`);
                updateValues.push(status === 'DONE');
                
                console.log('📊 4ステータス更新:', { 
                    todoId, 
                    status, 
                    completed: status === 'DONE' 
                });
            } else {
                console.warn('⚠️ 無効なステータス値:', status);
            }
        } else if (completed !== undefined) {
            // 後方互換性: completedのみが送信された場合（廃止予定）
            console.warn('⚠️ 廃止予定: completedフィールドの使用を検出。statusフィールドを使用してください。');
            updateFields.push(`completed = $${paramIndex++}`);
            updateValues.push(completed);
            
            // completedからstatusを推測（暫定的）
            updateFields.push(`status = $${paramIndex++}`);
            updateValues.push(completed ? 'DONE' : 'TODO');
        }
        
        if (tags !== undefined) {
            const tagsString = tags && Array.isArray(tags) ? tags.join(',') : tags;
            updateFields.push(`tags = $${paramIndex++}`);
            updateValues.push(tagsString);
        }
        
        if (parentId !== undefined) {
            updateFields.push(`"parentId" = $${paramIndex++}`);
            updateValues.push(parentId);
        }
        
        // 常に updatedAt を更新
        updateFields.push(`"updatedAt" = NOW()`);
        
        if (updateFields.length === 1) { // updatedAt のみの場合
            console.log('⚠️ No fields to update');
            return {
                success: false,
                error: 'No fields to update'
            };
        }
        
        const updateQuery = `
            UPDATE "Todo" 
            SET ${updateFields.join(', ')} 
            WHERE id = $1 AND "userId" = $2 
            RETURNING *
        `;
        
        const result = await client.query(updateQuery, [todoId, userId, ...updateValues]);
        const updatedTodo = result.rows[0];
        
        // タグを配列に変換
        const todoWithArrayTags = {
            ...updatedTodo,
            tags: updatedTodo.tags ? updatedTodo.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        };
        
        console.log('✅ Todo updated successfully:', {
            id: todoWithArrayTags.id,
            title: todoWithArrayTags.title,
            completed: todoWithArrayTags.completed,
            tags: todoWithArrayTags.tags
        });
        
        return {
            success: true,
            data: todoWithArrayTags,
            message: 'Todo updated successfully'
        };
        
    } catch (error) {
        console.error('❌ Todo update failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function deleteTodo(todoId, userId) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🗑️ Todo削除試行:', { 
            todoId, 
            todoIdType: typeof todoId,
            userId, 
            userIdType: typeof userId, 
            userIdLength: userId?.length,
            userIdPattern: /^\d+$/.test(userId) ? 'numeric' : 'non-numeric'
        });
        
        // まず、Todoが存在し、ユーザーがオーナーであることを確認
        console.log('🔍 SQL実行前:', {
            query: 'SELECT * FROM "Todo" WHERE id = $1 AND "userId" = $2',
            params: [todoId, userId],
            todoIdSql: todoId,
            userIdSql: userId
        });
        
        const existingTodoResult = await client.query(
            'SELECT * FROM "Todo" WHERE id = $1 AND "userId" = $2',
            [todoId, userId]
        );
        
        console.log('📊 SQL実行結果:', {
            rowCount: existingTodoResult.rows.length,
            foundTodos: existingTodoResult.rows.map(row => ({ 
                id: row.id, 
                userId: row.userId, 
                title: row.title?.substring(0, 20) + '...' 
            }))
        });
        
        if (existingTodoResult.rows.length === 0) {
            // さらに詳細な調査を行う
            console.log('🔍 詳細調査: Todoが見つからない原因を探る');
            
            // このTodoIDのTodoが存在するかチェック（ユーザー制限なし）
            const todoExistsResult = await client.query(
                'SELECT id, "userId", title FROM "Todo" WHERE id = $1',
                [todoId]
            );
            
            console.log('📋 TodoID存在確認:', {
                exists: todoExistsResult.rows.length > 0,
                foundTodo: todoExistsResult.rows[0] || null
            });
            
            if (todoExistsResult.rows.length > 0) {
                const foundTodo = todoExistsResult.rows[0];
                console.log('⚠️ Todoは存在するが、ユーザーID不一致:', {
                    requestedUserId: userId,
                    actualUserId: foundTodo.userId,
                    userIdMatch: userId === foundTodo.userId,
                    userIdStrictEqual: userId === foundTodo.userId,
                    bothTypes: typeof userId + ' vs ' + typeof foundTodo.userId
                });
            }
            
            console.log('❌ Todo not found or access denied:', { todoId, userId });
            return {
                success: false,
                error: 'Todo not found or access denied'
            };
        }
        
        const todoToDelete = existingTodoResult.rows[0];
        
        // Todoを削除
        const result = await client.query(
            'DELETE FROM "Todo" WHERE id = $1 AND "userId" = $2 RETURNING *',
            [todoId, userId]
        );
        
        const deletedTodo = result.rows[0];
        
        console.log('✅ Todo deleted successfully:', {
            id: deletedTodo.id,
            title: deletedTodo.title
        });
        
        return {
            success: true,
            data: deletedTodo,
            message: 'Todo deleted successfully'
        };
        
    } catch (error) {
        console.error('❌ Todo deletion failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// OAuth認証ユーザー確認・作成関数
async function ensureOAuthUser(userData) {
    const { id, email, name, image } = userData;
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔍 OAuth認証ユーザー確認:', { id, email, name });
        
        // 既存ユーザーチェック（IDで検索）
        const existingUserResult = await client.query(
            'SELECT id, email, name, image FROM "User" WHERE id = $1', 
            [id]
        );
        
        if (existingUserResult.rows.length > 0) {
            const existingUser = existingUserResult.rows[0];
            console.log('✅ 既存OAuth認証ユーザーを発見:', existingUser);
            
            // ユーザー情報を更新（名前や画像が変更されている可能性）
            const updateResult = await client.query(
                'UPDATE "User" SET name = $1, image = $2, "updatedAt" = NOW() WHERE id = $3 RETURNING *',
                [name || existingUser.name, image || existingUser.image, id]
            );
            
            return {
                success: true,
                data: updateResult.rows[0],
                message: 'OAuth user found and updated'
            };
        }
        
        // 新規OAuth認証ユーザー作成
        console.log('👤 新規OAuth認証ユーザー作成中...');
        const createUserResult = await client.query(
            'INSERT INTO "User" (id, email, name, image, password, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NULL, NOW(), NOW()) RETURNING *',
            [id, email, name || null, image || null]
        );
        
        const newUser = createUserResult.rows[0];
        console.log('✅ OAuth認証ユーザー作成成功:', newUser);
        
        return {
            success: true,
            data: newUser,
            message: 'OAuth user created successfully'
        };
        
    } catch (error) {
        console.error('❌ OAuth認証ユーザー確認・作成失敗:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// 🚀 最適化されたユーザー専用Todo取得関数
async function getUserTodos(userId) {
    let client = null;
    
    try {
        console.log('⚡ 高速ユーザー専用Todo取得開始:', { userId });
        const queryStart = Date.now();
        
        client = await connectToDatabase();
        
        // 🎯 インデックスを活用した高速クエリ（ORDER BY作成日の降順）
        console.log('🔍 SQL クエリ実行前:', {
            query: 'SELECT * FROM "Todo" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
            params: [userId],
            userIdForQuery: userId,
            userIdType: typeof userId,
            userIdLength: userId?.length
        });
        
        const result = await client.query(`
            SELECT 
                id,
                title,
                description,
                completed,
                status,
                priority,
                category,
                tags,
                "dueDate",
                "userId",
                "parentId",
                "createdAt",
                "updatedAt"
            FROM "Todo" 
            WHERE "userId" = $1 
            ORDER BY "createdAt" DESC
        `, [userId]);
        
        // タグデータを配列に変換
        const todosWithArrayTags = result.rows.map(todo => ({
            ...todo,
            tags: todo.tags ? todo.tags.split(',').map(tag => tag.trim()).filter(tag => tag) : []
        }));
        
        console.log('📊 SQL クエリ実行後:', {
            rowCount: result.rows.length,
            sampleRows: result.rows.slice(0, 3).map(row => ({
                id: row.id,
                title: row.title?.substring(0, 20),
                userId: row.userId,
                userIdType: typeof row.userId,
                userIdMatches: row.userId === userId,
                userIdStrictEqual: row.userId === userId
            }))
        });
        
        const queryTime = Date.now() - queryStart;
        console.log(`📊 クエリ実行時間: ${queryTime}ms, 取得件数: ${result.rows.length}`);
        
        // パフォーマンス分析
        const performanceLevel = queryTime < 100 ? '🟢 高速' : 
                                queryTime < 300 ? '🟡 普通' : '🔴 要改善';
        
        console.log(`✅ ユーザー専用Todo取得完了 (${queryTime}ms) ${performanceLevel}:`, {
            userId,
            todoCount: result.rows.length,
            performance: performanceLevel
        });
        
        return {
            success: true,
            data: todosWithArrayTags,
            metadata: {
                queryTime: queryTime,
                todoCount: todosWithArrayTags.length,
                userId: userId,
                performanceLevel: performanceLevel
            }
        };
        
    } catch (error) {
        console.error('❌ ユーザー専用Todo取得失敗:', error.message);
        return {
            success: false,
            error: error.message,
            data: []
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// OAuth対応の強制スキーマ更新関数
async function forceOAuthSchemaUpdate() {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔧 OAuth対応スキーマ強制更新開始...');
        
        const updateSteps = [];
        
        try {
            // 1. 既存のTodoテーブルからの制約削除
            console.log('🔄 外部キー制約削除中...');
            await client.query('ALTER TABLE "Todo" DROP CONSTRAINT IF EXISTS "Todo_userId_fkey"');
            updateSteps.push('外部キー制約削除完了');
            
            // 2. Userテーブルのid列をTEXT型に変更
            console.log('🔄 Userテーブルのid列をTEXT型に変更中...');
            await client.query('ALTER TABLE "User" ALTER COLUMN id TYPE TEXT');
            updateSteps.push('Userテーブルid列をTEXT型に変更完了');
            
            // 3. Userテーブルのpasswordを必須ではなくする
            console.log('🔄 Userテーブルのpassword制約変更中...');
            await client.query('ALTER TABLE "User" ALTER COLUMN password DROP NOT NULL');
            updateSteps.push('Userテーブルpassword制約変更完了');
            
            // 4. TodoテーブルのuserId列をTEXT型に変更
            console.log('🔄 TodoテーブルのuserId列をTEXT型に変更中...');
            await client.query('ALTER TABLE "Todo" ALTER COLUMN "userId" TYPE TEXT');
            updateSteps.push('TodoテーブルuserId列をTEXT型に変更完了');
            
            // 5. 外部キー制約を再追加
            console.log('🔄 外部キー制約再追加中...');
            await client.query('ALTER TABLE "Todo" ADD CONSTRAINT "Todo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE');
            updateSteps.push('外部キー制約再追加完了');
            
            console.log('✅ OAuth対応スキーマ更新完了');
            
            return {
                success: true,
                data: {
                    updateSteps: updateSteps
                },
                message: 'OAuth schema migration completed successfully'
            };
            
        } catch (updateError) {
            console.error('❌ スキーマ更新エラー:', updateError.message);
            return {
                success: false,
                error: updateError.message,
                data: {
                    completedSteps: updateSteps
                },
                message: 'OAuth schema migration failed'
            };
        }
        
    } catch (error) {
        console.error('❌ OAuth schema migration failed:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Database connection failed during OAuth migration'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// データインポート関数
async function importTodos(userId, userEmail, userName, todos) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('📥 Todoデータインポート開始:', { 
            userId, 
            userIdType: typeof userId,
            userIdLength: userId?.length,
            userEmail,
            userName,
            todoCount: todos.length,
            sampleTodos: todos.slice(0, 2).map(t => ({ title: t.title, priority: t.priority }))
        });
        
        // ユーザーが存在しない場合は作成
        try {
            await client.query(
                'INSERT INTO "User" (id, email, name, image, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
                [userId, userEmail, userName, null, new Date(), new Date()]
            );
        } catch (userError) {
            console.log('ℹ️ ユーザーは既に存在します:', userId);
        }
        
        let importedCount = 0;
        let skippedCount = 0;
        
        // 各Todoを処理
        for (const todo of todos) {
            try {
                // 重複チェック（同じユーザーのタイトルが一致するTodo）
                console.log('🔍 重複チェック実行:', {
                    userId: userId,
                    userIdType: typeof userId,
                    userIdLength: userId?.length,
                    todoTitle: todo.title,
                    todoTitleType: typeof todo.title
                });
                
                const existingTodo = await client.query(
                    'SELECT id, "userId", title FROM "Todo" WHERE "userId" = $1 AND title = $2',
                    [userId, todo.title]
                );
                
                console.log('🔍 重複チェック結果:', {
                    found: existingTodo.rows.length,
                    existingRows: existingTodo.rows,
                    searchUserId: userId,
                    searchTitle: todo.title
                });
                
                if (existingTodo.rows.length > 0) {
                    console.log('⏭️ 既存Todoをスキップ:', {
                        title: todo.title,
                        existingTodo: existingTodo.rows[0]
                    });
                    skippedCount++;
                    continue;
                }
                
                console.log('✅ 重複なし、Todoを挿入開始:', todo.title);
                
                // Todoを挿入
                const insertResult = await client.query(
                    'INSERT INTO "Todo" (title, description, priority, category, "dueDate", "userId", completed, tags, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
                    [
                        todo.title || 'Untitled',
                        todo.description || '',
                        todo.priority || 'medium',
                        todo.category || 'general',
                        todo.dueDate ? new Date(todo.dueDate) : null,
                        userId,
                        false,
                        todo.tags ? (Array.isArray(todo.tags) ? todo.tags : [todo.tags]) : [],
                        new Date(),
                        new Date()
                    ]
                );
                
                if (insertResult.rows.length > 0) {
                    importedCount++;
                    console.log('✅ Todoインポート成功:', { 
                        id: insertResult.rows[0].id, 
                        title: todo.title 
                    });
                }
                
            } catch (todoError) {
                console.error('❌ Todoインポートエラー:', {
                    title: todo.title,
                    error: todoError.message,
                    errorStack: todoError.stack,
                    errorCode: todoError.code,
                    errorDetail: todoError.detail,
                    insertData: {
                        title: todo.title || 'Untitled',
                        description: todo.description || '',
                        priority: todo.priority || 'medium',
                        category: todo.category || 'general',
                        dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
                        userId: userId,
                        isCompleted: false,
                        tags: todo.tags || ''
                    }
                });
                skippedCount++;
            }
        }
        
        console.log('📊 インポート完了:', { importedCount, skippedCount, total: todos.length });
        
        return {
            success: true,
            importedCount,
            skippedCount,
            totalCount: todos.length,
            message: `Successfully imported ${importedCount} todos (${skippedCount} skipped)`
        };
        
    } catch (error) {
        console.error('❌ データインポートエラー:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to import data'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// パスワード変更関数
async function changePassword(userId, currentPassword, newPassword) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔐 パスワード変更処理開始:', { userId });
        
        // ユーザー検索とパスワード取得
        const userResult = await client.query(
            'SELECT id, email, password FROM "User" WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません:', userId);
            return {
                success: false,
                error: 'User not found'
            };
        }
        
        const user = userResult.rows[0];
        
        // 現在のパスワードを検証
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!isValidPassword) {
            console.log('❌ 現在のパスワードが間違っています:', userId);
            return {
                success: false,
                error: 'Invalid current password'
            };
        }
        
        // 新しいパスワードをハッシュ化
        const saltRounds = 12;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
        
        // パスワードを更新
        const updateResult = await client.query(
            'UPDATE "User" SET password = $1, "updatedAt" = $2 WHERE id = $3',
            [hashedNewPassword, new Date(), userId]
        );
        
        if (updateResult.rowCount > 0) {
            console.log('✅ パスワード変更成功:', { userId, email: user.email });
            return {
                success: true,
                message: 'Password changed successfully'
            };
        } else {
            return {
                success: false,
                error: 'Failed to update password'
            };
        }
        
    } catch (error) {
        console.error('❌ パスワード変更エラー:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Failed to change password'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// ユーザー情報更新関数
async function updateUser(userId, updateData) {
    let client = null;
    
    try {
        console.log('🔄 updateUser 関数開始:', { userId, updateData });
        
        client = await connectToDatabase();
        console.log('🔗 データベース接続成功');
        
        console.log('📝 ユーザー情報更新開始:', { userId, updateData });
        
        const { name, image } = updateData;
        console.log('📋 抽出したデータ:', { name, image, userId });
        
        // まずユーザーが存在するか確認
        console.log('🔍 ユーザー存在確認中...');
        const userCheckResult = await client.query(
            'SELECT id, name, email, image FROM "User" WHERE id = $1',
            [userId]
        );
        
        console.log('👤 ユーザー存在確認結果:', {
            found: userCheckResult.rows.length > 0,
            userId,
            existingUser: userCheckResult.rows[0] || null
        });
        
        if (userCheckResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません:', userId);
            return {
                success: false,
                error: 'User not found'
            };
        }
        
        // ユーザー情報を更新
        console.log('🔄 ユーザー情報更新実行中...', {
            query: 'UPDATE "User" SET name = $1, image = $2, "updatedAt" = $3 WHERE id = $4 RETURNING id, name, email, image, "createdAt", "updatedAt"',
            params: [name, image, new Date(), userId]
        });
        
        const updateResult = await client.query(
            'UPDATE "User" SET name = $1, image = $2, "updatedAt" = $3 WHERE id = $4 RETURNING id, name, email, image, "createdAt", "updatedAt"',
            [name, image, new Date(), userId]
        );
        
        console.log('📊 UPDATE クエリ結果:', {
            rowCount: updateResult.rowCount,
            rows: updateResult.rows
        });
        
        if (updateResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません:', userId);
            return {
                success: false,
                error: 'User not found'
            };
        }
        
        const updatedUser = updateResult.rows[0];
        
        console.log('✅ ユーザー情報更新成功:', { 
            userId: updatedUser.id, 
            name: updatedUser.name,
            hasImage: !!updatedUser.image
        });
        
        return {
            success: true,
            data: {
                user: {
                    id: updatedUser.id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    image: updatedUser.image,
                    createdAt: updatedUser.createdAt,
                    updatedAt: updatedUser.updatedAt
                }
            },
            message: 'User updated successfully'
        };
        
    } catch (error) {
        console.error('❌💥 updateUser 関数でエラー発生:', {
            error,
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            internalPosition: error.internalPosition,
            internalQuery: error.internalQuery,
            where: error.where,
            schema: error.schema,
            table: error.table,
            column: error.column,
            dataType: error.dataType,
            constraint: error.constraint,
            file: error.file,
            line: error.line,
            routine: error.routine,
            userId,
            updateData
        });
        
        return {
            success: false,
            error: error.message,
            details: {
                code: error.code,
                detail: error.detail,
                hint: error.hint
            },
            message: 'Failed to update user'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// 保存済み検索関数
async function getSavedSearchesByUser(userId) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🔍 保存済み検索取得中:', { userId });
        
        // SavedSearchテーブルが存在しない場合は作成
        await client.query(`
            CREATE TABLE IF NOT EXISTS "SavedSearch" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                filters TEXT,
                "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        
        const result = await client.query(
            'SELECT * FROM "SavedSearch" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
            [userId]
        );
        
        console.log(`✅ 保存済み検索${result.rows.length}件取得`);
        
        return {
            success: true,
            data: result.rows,
            message: `Retrieved ${result.rows.length} saved searches`
        };
        
    } catch (error) {
        console.error('❌ 保存済み検索取得失敗:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function createSavedSearch(savedSearchData) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('➕ 保存済み検索作成中:', savedSearchData);
        
        const { name, filters, userId } = savedSearchData;
        
        // SavedSearchテーブルが存在しない場合は作成
        await client.query(`
            CREATE TABLE IF NOT EXISTS "SavedSearch" (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                filters TEXT,
                "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        
        // ユーザーが存在するかチェック、存在しなければ作成
        const userCheck = await client.query('SELECT id FROM "User" WHERE id = $1', [userId]);
        
        if (userCheck.rows.length === 0) {
            console.log('👤 ユーザーが存在しないため作成中:', userId);
            // 最小限の情報でユーザーを作成（emailは一時的なもの）
            await client.query(
                'INSERT INTO "User" (id, email, "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW())',
                [userId, `user-${userId}@saved-search.local`]
            );
            console.log('✅ ユーザー作成完了:', userId);
        }
        
        const result = await client.query(
            'INSERT INTO "SavedSearch" (name, filters, "userId", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW()) RETURNING *',
            [name, typeof filters === 'string' ? filters : JSON.stringify(filters), userId]
        );
        
        const savedSearch = result.rows[0];
        console.log('✅ 保存済み検索作成成功:', savedSearch);
        
        return {
            success: true,
            data: savedSearch,
            message: 'Saved search created successfully'
        };
        
    } catch (error) {
        console.error('❌ 保存済み検索作成失敗:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

async function deleteSavedSearch(searchId, userId) {
    let client = null;
    
    try {
        client = await connectToDatabase();
        
        console.log('🗑️ 保存済み検索削除中:', { searchId, userId });
        
        // 検索が存在し、ユーザーがオーナーであることを確認
        const existingResult = await client.query(
            'SELECT * FROM "SavedSearch" WHERE id = $1 AND "userId" = $2',
            [searchId, userId]
        );
        
        if (existingResult.rows.length === 0) {
            return {
                success: false,
                error: 'Saved search not found or access denied'
            };
        }
        
        const result = await client.query(
            'DELETE FROM "SavedSearch" WHERE id = $1 AND "userId" = $2 RETURNING *',
            [searchId, userId]
        );
        
        const deletedSearch = result.rows[0];
        console.log('✅ 保存済み検索削除成功:', { id: deletedSearch.id, name: deletedSearch.name });
        
        return {
            success: true,
            data: deletedSearch,
            message: 'Saved search deleted successfully'
        };
        
    } catch (error) {
        console.error('❌ 保存済み検索削除失敗:', error.message);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

// アカウント削除関数
async function deleteAccount(userId, userEmail, confirmationText, password, reason) {
    let client = null;
    
    try {
        console.log('🗑️ deleteAccount 関数開始:', { userId, userEmail, confirmationText, reason });
        
        client = await connectToDatabase();
        console.log('🔗 データベース接続成功');
        
        // まずユーザーが存在するか確認
        console.log('🔍 ユーザー存在確認中...');
        const userResult = await client.query(
            'SELECT id, email, name, password, "createdAt" FROM "User" WHERE id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            console.log('❌ ユーザーが見つかりません:', userId);
            return {
                success: false,
                error: 'User not found'
            };
        }
        
        const user = userResult.rows[0];
        console.log('👤 削除対象ユーザー:', { 
            id: user.id, 
            email: user.email, 
            name: user.name,
            hasPassword: !!user.password,
            createdAt: user.createdAt
        });
        
        // パスワード認証ユーザーの場合、パスワード確認
        if (user.password && password) {
            console.log('🔐 パスワード認証確認中...');
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                console.log('❌ パスワードが無効');
                return {
                    success: false,
                    error: 'Invalid password'
                };
            }
            console.log('✅ パスワード認証成功');
        }
        
        // 削除前のデータ統計取得
        const todoCountResult = await client.query(
            'SELECT COUNT(*) as count FROM "Todo" WHERE "userId" = $1',
            [userId]
        );
        const todoCount = parseInt(todoCountResult.rows[0].count);
        
        // 削除統計
        const deletionStats = {
            userId: user.id,
            email: user.email,
            name: user.name,
            todoCount: todoCount,
            authMethod: user.password ? 'credentials' : 'oauth',
            createdAt: user.createdAt,
            deletedAt: new Date().toISOString(),
            reason: reason || 'Not specified'
        };
        
        console.log('📊 削除前統計:', deletionStats);
        
        // トランザクションで削除実行
        await client.query('BEGIN');
        
        try {
            // 1. Todoの削除
            console.log('📝 Todo削除中...');
            const deletedTodos = await client.query(
                'DELETE FROM "Todo" WHERE "userId" = $1',
                [userId]
            );
            console.log(`🗑️ ${deletedTodos.rowCount} 件のTodoを削除`);
            
            // 2. ユーザー削除
            console.log('👤 ユーザー削除中...');
            const deletedUser = await client.query(
                'DELETE FROM "User" WHERE id = $1',
                [userId]
            );
            console.log(`🗑️ ${deletedUser.rowCount} 件のユーザーを削除`);
            
            await client.query('COMMIT');
            console.log('✅ アカウント削除トランザクション完了');
            
        } catch (transactionError) {
            await client.query('ROLLBACK');
            console.error('❌ トランザクションエラー:', transactionError);
            throw transactionError;
        }
        
        // GDPR準拠ログ記録
        console.log('📋 GDPR削除ログ:', {
            type: 'account_deletion',
            timestamp: deletionStats.deletedAt,
            userId: deletionStats.userId,
            email: deletionStats.email,
            method: 'lambda_api_complete'
        });
        
        return {
            success: true,
            message: 'Account deleted successfully',
            stats: {
                todoCount: deletionStats.todoCount,
                authMethod: deletionStats.authMethod,
                memberSince: deletionStats.createdAt,
                deletedAt: deletionStats.deletedAt
            }
        };
        
    } catch (error) {
        console.error('❌ アカウント削除エラー:', error);
        return {
            success: false,
            error: error.message,
            message: 'Failed to delete account'
        };
    } finally {
        if (client) {
            client.release();
        }
    }
}

exports.handler = async (event) => {
    console.log('🚀 Lambda関数開始 - Phase 3: Todo CRUD機能完全版');
    console.log('📨 受信イベント:', JSON.stringify(event, null, 2));
    
    // HTTPメソッドとパスの特定
    const method = event.requestContext?.http?.method || event.httpMethod || 'UNKNOWN';
    const path = event.requestContext?.http?.path || event.path || '/';
    
    console.log(`🌐 HTTPメソッド: ${method}, パス: ${path}`);

    try {
        // ルートヘルスチェック + データベース接続テスト + スキーマ確認
        if (method === 'GET' && (path === '/prod/' || path === '/')) {
            console.log('🏥 ヘルスチェック + PostgreSQL接続テスト + スキーマ確認実行中...');
            
            const dbTest = await testDatabaseConnection();
            const schemaCheck = await ensureDatabaseSchema();
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                body: JSON.stringify({
                    message: 'SUCCESS - POSTGRESQL CONNECTION WITH SCHEMA',
                    version: 'phase-3-todo-crud',
                    database: dbTest,
                    schema: schemaCheck,
                    availableEndpoints: [
                        'GET / - ヘルスチェック + PostgreSQL接続テスト + スキーマ確認',
                        'GET /todos - 全Todo取得',
                        'POST /todos - Todo作成',
                        'PUT /todos/:id - Todo更新',
                        'DELETE /todos/:id - Todo削除',
                        'POST /auth/register - ユーザー登録',
                        'POST /auth/login - ユーザーログイン',
                        'POST /import-todos - Todoデータインポート',
                        'POST /auth/change-password - パスワード変更',
                        'POST /auth/update-user - ユーザー情報更新',
                        'POST /auth/delete-account - アカウント削除',
                        'GET /saved-searches/user/{userId} - 保存済み検索取得',
                        'POST /saved-searches - 保存済み検索作成',
                        'DELETE /saved-searches/{id} - 保存済み検索削除',
                        'POST /time-entries/start - 時間計測開始',
                        'POST /time-entries/stop - 時間計測停止',
                        'GET /time-entries/summary?userId={userId} - 時間サマリ取得',
                        'GET /time-entries/analytics?userId={userId}&days={days} - 時間分析データ取得',
                        'GET /time-entries/tasks?userId={userId}&limit={limit}&sortBy={sortBy} - タスク別統計取得',
                        'GET /time-entries/goals?userId={userId} - 時間目標取得',
                        'POST /time-entries/goals - 時間目標設定'
                    ],
                    environment: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        arch: process.arch,
                        hasDatabase: !!(process.env.DATABASE_URL || process.env.DB_HOST),
                        dbSource: process.env.DATABASE_URL ? 'DATABASE_URL' : 'individual_vars',
                        sslMode: process.env.SSL_MODE || 'basic'
                    },
                    timestamp: new Date().toISOString()
                })
            };
        }

        // 🚀 最適化されたユーザー専用Todoエンドポイント（優先度：高）
        if (method === 'GET' && (path.includes('/todos/user/') && !path.endsWith('/todos/user'))) {
            console.log('⚡ 高速ユーザー専用Todo取得中...');
            console.log('🔍 リクエスト詳細:', {
                method: method,
                path: path
            });
            
            // pathからuserIdを抽出 (/prod/todos/user/cuid123 → cuid123)
            const pathSegments = path.split('/');
            const userId = pathSegments[pathSegments.length - 1];
            
            console.log('🆔 ユーザーID抽出結果:', {
                pathSegments: pathSegments,
                extractedUserId: userId,
                userIdType: typeof userId,
                userIdLength: userId?.length
            });
            
            if (!userId || userId === 'user') {
                console.log('❌ 無効なユーザーID:', userId);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Valid user ID is required',
                        receivedPath: path,
                        extractedUserId: userId
                    })
                };
            }
            
            console.log('🎯 getUserTodos関数呼び出し開始:', userId);
            const result = await getUserTodos(userId);
            console.log('📊 getUserTodos関数結果:', {
                success: result.success,
                dataCount: result.data ? result.data.length : 0,
                error: result.error,
                sampleData: result.success && result.data ? result.data.slice(0, 3).map(todo => ({
                    id: todo.id,
                    title: todo.title?.substring(0, 20),
                    userId: todo.userId,
                    userIdMatches: todo.userId === userId
                })) : null
            });
            
            return {
                statusCode: result.success ? 200 : 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result.success ? result.data : { error: result.error })
            };
        }

        // Todo関連エンドポイント（一般）
        if (path.includes('/todos') && !path.includes('/todos/user/')) {
            // GET /todos - Todo一覧取得
            if (method === 'GET') {
                console.log('📋 Todo一覧取得中...');
                
                const userId = event.queryStringParameters?.userId;
                const result = await getTodos(userId);
                
                return {
                    statusCode: result.success ? 200 : 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
            
            // POST /todos - Todo作成
            if (method === 'POST') {
                console.log('➕ Todo作成中...');
                
                let body;
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
                
                console.log('📝 Todo作成データ:', body);
                
                if (!body.title || !body.userId) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Title and userId are required'
                        })
                    };
                }
                
                const result = await createTodo(body);
                
                return {
                    statusCode: result.success ? 201 : 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
            
            // PUT /todos/:id - Todo更新
            if (method === 'PUT') {
                console.log('🔄 Todo更新中...');
                
                // pathからtodoIdを抽出 (/prod/todos/123 → 123)
                const pathSegments = path.split('/');
                const todoId = pathSegments[pathSegments.length - 1];
                
                if (!todoId || isNaN(parseInt(todoId))) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Valid todo ID is required'
                        })
                    };
                }
                
                let body;
                try {
                    if (typeof event.body === 'string') {
                        body = JSON.parse(event.body);
                    } else {
                        body = event.body;
                    }
                } catch (jsonError) {
                    console.error('❌ JSON解析エラー:', jsonError.message);
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Invalid JSON format in request body'
                        })
                    };
                }
                
                if (!body.userId) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'User ID is required'
                        })
                    };
                }
                
                console.log('📝 Todo更新データ:', { todoId, userId: body.userId, updates: body });
                
                const result = await updateTodo(parseInt(todoId), body, body.userId); // userIdは文字列のまま
                
                return {
                    statusCode: result.success ? 200 : (result.error.includes('not found') ? 404 : 500),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
            
            // DELETE /todos/:id - Todo削除
            if (method === 'DELETE') {
                console.log('🗑️ Todo削除中...');
                
                // pathからtodoIdを抽出 (/prod/todos/123 → 123)
                const pathSegments = path.split('/');
                const todoId = pathSegments[pathSegments.length - 1];
                
                if (!todoId || isNaN(parseInt(todoId))) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Valid todo ID is required'
                        })
                    };
                }
                
                // DELETEリクエストの場合、userIdはクエリパラメータまたはヘッダーから取得
                const userId = event.queryStringParameters?.userId || event.headers?.['x-user-id'];
                
                if (!userId) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'User ID is required (query parameter or x-user-id header)'
                        })
                    };
                }
                
                console.log('📝 Todo削除データ:', { 
                    todoId, 
                    userId, 
                    userIdType: typeof userId, 
                    userIdLength: userId?.length,
                    isGoogleId: userId?.length === 21,
                    isGitHubId: /^\d+$/.test(userId) && userId?.length < 15
                });
                
                const result = await deleteTodo(parseInt(todoId), userId); // userIdは文字列のまま
                
                return {
                    statusCode: result.success ? 200 : (result.error.includes('not found') ? 404 : 500),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
        }

        // スキーマ確認・作成エンドポイント
        if (method === 'POST' && path.includes('/schema/ensure')) {
            console.log('🔨 データベーススキーマ確認・作成処理中...');
            
            const result = await ensureDatabaseSchema();
            
            return {
                statusCode: result.success ? 200 : 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // OAuth対応スキーマ強制更新エンドポイント
        if (method === 'POST' && path.includes('/schema/oauth-migrate')) {
            console.log('🔧 OAuth対応スキーマ強制更新処理中...');
            
            const result = await forceOAuthSchemaUpdate();
            
            return {
                statusCode: result.success ? 200 : 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // ユーザー登録エンドポイント
        if (method === 'POST' && path.includes('/auth/register')) {
            console.log('👤 ユーザー登録処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }
            
            console.log('📝 ユーザー登録データ:', { ...body, password: '[REDACTED]' });
            
            const { email, password, name } = body;
            
            // 入力値検証
            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Email and password are required'
                    })
                };
            }
            
            // メールアドレス形式検証
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid email address format'
                    })
                };
            }
            
            // パスワード長検証
            if (password.length < 8) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Password must be at least 8 characters long'
                    })
                };
            }
            
            // パスワード強度検証（オプション）
            if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*\d)|(?=.*[@$!%*?&])/.test(password)) {
                console.warn('⚠️ 弱いパスワードが使用されています');
            }
            
            const result = await registerUser(body);
            
            return {
                statusCode: result.success ? 201 : 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result.success ? {
                    message: result.message,
                    user: result.data
                } : {
                    error: result.error
                })
            };
        }

        // OAuth認証ユーザー確認・作成エンドポイント
        if (method === 'POST' && (path.includes('/auth/oauth-ensure') || (path.includes('/auth') && event.body && event.body.includes('oauth-ensure')))) {
            console.log('🔍 OAuth認証ユーザー確認・作成処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }
            
            const result = await ensureOAuthUser(body);
            
            return {
                statusCode: result.success ? 200 : 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // ユーザーログインエンドポイント
        if (method === 'POST' && path.includes('/auth/login')) {
            console.log('🔐 ユーザーログイン処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }
            
            console.log('📝 ログインデータ:', { ...body, password: '[REDACTED]' });
            
            const { email, password } = body;
            
            // 入力値検証
            if (!email || !password) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Email and password are required'
                    })
                };
            }
            
            const result = await loginUser(body);
            
            return {
                statusCode: result.success ? 200 : 401,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // POST /import-todos - データインポート
        if (method === 'POST' && path.includes('/import-todos')) {
            console.log('📥 Todoデータインポート処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }

            const { userId, userEmail, userName, todos } = body;

            if (!userId || !todos || !Array.isArray(todos)) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'User ID and todos array are required'
                    })
                };
            }

            console.log('📊 インポートデータ:', { userId, todoCount: todos.length });

            const result = await importTodos(userId, userEmail, userName, todos);

            return {
                statusCode: result.success ? 200 : 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // POST /auth/change-password - パスワード変更
        if (method === 'POST' && path.includes('/auth/change-password')) {
            console.log('🔐 パスワード変更処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }

            const { userId, currentPassword, newPassword } = body;

            if (!userId || !currentPassword || !newPassword) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'User ID, current password, and new password are required'
                    })
                };
            }

            console.log('🔑 パスワード変更リクエスト:', { userId, hasCurrentPassword: !!currentPassword, hasNewPassword: !!newPassword });

            const result = await changePassword(userId, currentPassword, newPassword);

            return {
                statusCode: result.success ? 200 : (result.error.includes('Invalid') ? 400 : 500),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // POST /auth/update-user - ユーザー情報更新
        if (method === 'POST' && path.includes('/auth/update-user')) {
            console.log('👤 ユーザー情報更新処理中...');
            console.log('🔍 Raw event body:', event.body);
            console.log('🔍 Event body type:', typeof event.body);
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
                console.log('✅ Parsed body:', body);
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body',
                        details: jsonError.message
                    })
                };
            }

            const { userId, name, image } = body;
            console.log('🔍 Extracted values:', { userId, name, image, hasUserId: !!userId, hasName: !!name });

            if (!userId || !name) {
                console.log('❌ Validation failed:', { userIdProvided: !!userId, nameProvided: !!name });
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'User ID and name are required',
                        received: { userId: !!userId, name: !!name }
                    })
                };
            }

            console.log('📝 ユーザー更新データ:', { userId, name, hasImage: !!image });

            try {
                const result = await updateUser(userId, { name, image });
                console.log('🔄 updateUser result:', result);

                return {
                    statusCode: result.success ? 200 : (result.error?.includes('not found') ? 404 : 500),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result)
                };
            } catch (updateError) {
                console.error('💥 updateUser exception:', updateError);
                return {
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Internal server error',
                        details: updateError.message,
                        timestamp: new Date().toISOString()
                    })
                };
            }
        }

        // POST /auth/delete-account - アカウント削除
        if (method === 'POST' && path.includes('/auth/delete-account')) {
            console.log('🗑️ アカウント削除処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                console.error('❌ JSON解析エラー:', jsonError.message);
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Invalid JSON format in request body'
                    })
                };
            }

            const { userId, userEmail, confirmationText, password, reason } = body;

            if (!userId || !userEmail || !confirmationText) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'User ID, email, and confirmation text are required'
                    })
                };
            }

            if (confirmationText !== 'DELETE') {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify({
                        error: 'Confirmation text must be "DELETE"'
                    })
                };
            }

            console.log('🗑️ アカウント削除リクエスト:', { 
                userId, 
                userEmail, 
                hasPassword: !!password, 
                reason 
            });

            const result = await deleteAccount(userId, userEmail, confirmationText, password, reason);

            return {
                statusCode: result.success ? 200 : (result.error.includes('Invalid') || result.error.includes('not found') ? 400 : 500),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify(result)
            };
        }

        // 保存済み検索エンドポイント
        if (path.includes('/saved-searches')) {
            // GET /saved-searches/user/{userId} - ユーザーの保存済み検索取得
            if (method === 'GET' && path.includes('/saved-searches/user/')) {
                console.log('🔍 保存済み検索取得処理中...');
                
                const pathSegments = path.split('/');
                const userId = pathSegments[pathSegments.length - 1];
                
                if (!userId || userId === 'user') {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Valid user ID is required'
                        })
                    };
                }
                
                const result = await getSavedSearchesByUser(userId);
                
                return {
                    statusCode: result.success ? 200 : 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
            
            // POST /saved-searches - 保存済み検索作成
            if (method === 'POST' && !path.includes('/saved-searches/')) {
                console.log('➕ 保存済み検索作成処理中...');
                
                let body;
                try {
                    if (typeof event.body === 'string') {
                        body = JSON.parse(event.body);
                    } else {
                        body = event.body;
                    }
                } catch (jsonError) {
                    console.error('❌ JSON解析エラー:', jsonError.message);
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Invalid JSON format in request body'
                        })
                    };
                }
                
                const { name, filters, userId } = body;
                
                if (!name || !userId) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Name and userId are required'
                        })
                    };
                }
                
                const result = await createSavedSearch({ name, filters, userId });
                
                return {
                    statusCode: result.success ? 201 : 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? result.data : { error: result.error })
                };
            }
            
            // DELETE /saved-searches/{id} - 保存済み検索削除
            if (method === 'DELETE' && path.includes('/saved-searches/')) {
                console.log('🗑️ 保存済み検索削除処理中...');
                
                const pathSegments = path.split('/');
                const searchId = pathSegments[pathSegments.length - 1];
                
                if (!searchId || isNaN(parseInt(searchId))) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'Valid search ID is required'
                        })
                    };
                }
                
                // userIdはクエリパラメータまたはヘッダーから取得
                const userId = event.queryStringParameters?.userId || event.headers?.['x-user-id'];
                
                if (!userId) {
                    return {
                        statusCode: 400,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*'
                        },
                        body: JSON.stringify({
                            error: 'User ID is required (query parameter or x-user-id header)'
                        })
                    };
                }
                
                const result = await deleteSavedSearch(parseInt(searchId), userId);
                
                return {
                    statusCode: result.success ? 200 : (result.error.includes('not found') ? 404 : 500),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    body: JSON.stringify(result.success ? { message: result.message } : { error: result.error })
                };
            }
        }

        // OPTIONS プリフライトリクエスト対応
        if (method === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                },
                body: ''
            };
        }

        // POST /time-entries/start - 時間計測開始
        if (method === 'POST' && path.includes('/time-entries/start')) {
            console.log('⏱️ 時間計測開始処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (parseError) {
                console.error('❌ リクエストボディのパースエラー:', parseError);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Invalid JSON format' })
                };
            }

            const { userId, todoId } = body;
            
            if (!userId || !todoId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId and todoId are required' })
                };
            }

            let client = null;
            try {
                client = await connectToDatabase();
                
                // ユーザーの存在確認と自動作成
                const userCheckResult = await client.query(
                    'SELECT id FROM "User" WHERE id = $1',
                    [userId]
                );
                
                if (userCheckResult.rows.length === 0) {
                    console.log(`👤 ユーザー ${userId} が存在しないため自動作成中...`);
                    
                    // デフォルトのメールアドレスとユーザー名を生成
                    const defaultEmail = `${userId}@auto-generated.local`;
                    const defaultName = `User_${userId.slice(-8)}`; // userIdの末尾8文字を使用
                    
                    try {
                        await client.query(
                            'INSERT INTO "User" (id, email, name, "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())',
                            [userId, defaultEmail, defaultName]
                        );
                        console.log(`✅ ユーザー自動作成完了: ${userId} (${defaultName})`);
                    } catch (userCreateError) {
                        if (userCreateError.code === '23505') { // unique constraint violation
                            console.log(`⚠️ ユーザー ${userId} は既に存在するか重複エラー - 処理を続行`);
                        } else {
                            throw userCreateError;
                        }
                    }
                }
                
                // 既に進行中のタスクがあれば停止
                const activeEntry = await client.query(
                    'SELECT * FROM "TimeEntry" WHERE "userId" = $1 AND "endedAt" IS NULL LIMIT 1',
                    [userId]
                );
                
                if (activeEntry.rows.length > 0) {
                    const entry = activeEntry.rows[0];
                    const endedAt = new Date();
                    const duration = Math.max(0, Math.floor((endedAt.getTime() - new Date(entry.startedAt).getTime()) / 1000));
                    
                    await client.query(
                        'UPDATE "TimeEntry" SET "endedAt" = $1, duration = $2, "updatedAt" = NOW() WHERE id = $3',
                        [endedAt, duration, entry.id]
                    );
                    console.log(`✅ 既存タスク停止: ID ${entry.id}, 時間 ${duration}秒`);
                }
                
                // 新しい時間計測を開始
                const result = await client.query(
                    'INSERT INTO "TimeEntry" ("userId", "todoId", "startedAt", "createdAt", "updatedAt") VALUES ($1, $2, NOW(), NOW(), NOW()) RETURNING id, "startedAt"',
                    [userId, todoId]
                );
                
                console.log(`✅ 新しい時間計測開始: ID ${result.rows[0].id}`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        success: true, 
                        entryId: result.rows[0].id,
                        startedAt: result.rows[0].startedAt
                    })
                };
                
            } catch (error) {
                console.error('❌ 時間計測開始エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Failed to start time tracking', details: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }
        
        // POST /time-entries/stop - 時間計測停止
        if (method === 'POST' && path.includes('/time-entries/stop')) {
            console.log('⏹️ 時間計測停止処理中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (parseError) {
                console.error('❌ リクエストボディのパースエラー:', parseError);
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Invalid JSON format' })
                };
            }

            const { userId } = body;
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId is required' })
                };
            }

            let client = null;
            try {
                client = await connectToDatabase();
                
                // 進行中のタスクを検索
                const activeEntry = await client.query(
                    'SELECT te.*, t.title as "todoTitle" FROM "TimeEntry" te LEFT JOIN "Todo" t ON te."todoId" = t.id WHERE te."userId" = $1 AND te."endedAt" IS NULL LIMIT 1',
                    [userId]
                );
                
                if (activeEntry.rows.length === 0) {
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ success: true, stopped: false, message: 'No active time tracking found' })
                    };
                }
                
                const entry = activeEntry.rows[0];
                const endedAt = new Date();
                const duration = Math.max(0, Math.floor((endedAt.getTime() - new Date(entry.startedAt).getTime()) / 1000));
                
                await client.query(
                    'UPDATE "TimeEntry" SET "endedAt" = $1, duration = $2, "updatedAt" = NOW() WHERE id = $3',
                    [endedAt, duration, entry.id]
                );
                
                console.log(`✅ 時間計測停止: ID ${entry.id}, 時間 ${duration}秒`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ 
                        success: true, 
                        stopped: true,
                        entryId: entry.id,
                        duration: duration,
                        durationMinutes: Math.floor(duration / 60),
                        todoTitle: entry.todoTitle
                    })
                };
                
            } catch (error) {
                console.error('❌ 時間計測停止エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Failed to stop time tracking', details: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }
        
        // GET /time-entries/summary - 今日/今週の合計時間（タイムゾーン対応：UTC / Asia/Tokyo）
        if (method === 'GET' && path.includes('/time-entries/summary')) {
            console.log('📊 時間サマリ取得中...');
            
            const userId = event.queryStringParameters?.userId;
            const tz = event.queryStringParameters?.tz || 'UTC';
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId query parameter is required' })
                };
            }

            let client = null;
            try {
                client = await connectToDatabase();
                
                // タイムゾーンオフセット（分）: サポートはUTC/Asia-Tokyoのみ（DST不要）
                const offsetMinutes = tz === 'Asia/Tokyo' ? 9 * 60 : 0;
                const nowUtc = new Date();
                const nowShifted = new Date(nowUtc.getTime() + offsetMinutes * 60 * 1000);
                
                // 今日開始（選択TZの00:00）→UTCに戻す
                const startOfDayShifted = new Date(nowShifted);
                startOfDayShifted.setHours(0, 0, 0, 0);
                const todayStart = new Date(startOfDayShifted.getTime() - offsetMinutes * 60 * 1000);
                
                // 週開始（選択TZの月曜00:00）→UTCに戻す
                const startOfWeekShifted = new Date(nowShifted);
                const dayOfWeek = startOfWeekShifted.getDay();
                const offsetDow = (dayOfWeek + 6) % 7; // 月曜始まり
                startOfWeekShifted.setDate(startOfWeekShifted.getDate() - offsetDow);
                startOfWeekShifted.setHours(0, 0, 0, 0);
                const weekStart = new Date(startOfWeekShifted.getTime() - offsetMinutes * 60 * 1000);
                
                // 今日の完了した作業時間
                const todayResult = await client.query(
                    'SELECT COALESCE(SUM(duration), 0) as total FROM "TimeEntry" WHERE "userId" = $1 AND "startedAt" >= $2 AND "startedAt" < $3 AND "endedAt" IS NOT NULL',
                    [userId, todayStart, new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)]
                );
                
                // 今週の完了した作業時間
                const weekResult = await client.query(
                    'SELECT COALESCE(SUM(duration), 0) as total FROM "TimeEntry" WHERE "userId" = $1 AND "startedAt" >= $2 AND "endedAt" IS NOT NULL',
                    [userId, weekStart]
                );
                
                // 進行中のタスクがあれば加算
                const activeResult = await client.query(
                    'SELECT "startedAt" FROM "TimeEntry" WHERE "userId" = $1 AND "endedAt" IS NULL LIMIT 1',
                    [userId]
                );
                
                let todaySeconds = parseInt(todayResult.rows[0].total, 10);
                let weekSeconds = parseInt(weekResult.rows[0].total, 10);
                
                if (activeResult.rows.length > 0) {
                    const startedAt = new Date(activeResult.rows[0].startedAt);
                    const now = nowUtc; // UTC基準
                    const currentDuration = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
                    
                    if (startedAt >= todayStart) {
                        todaySeconds += currentDuration;
                    }
                    if (startedAt >= weekStart) {
                        weekSeconds += currentDuration;
                    }
                }
                
                console.log(`✅ 時間サマリ取得: tz=${tz} 今日 ${todaySeconds}秒, 今週 ${weekSeconds}秒`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ todaySeconds, weekSeconds })
                };
                
            } catch (error) {
                console.error('❌ 時間サマリ取得エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ todaySeconds: 0, weekSeconds: 0, error: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }

        // GET /time-entries/active - 現在計測中のエントリ（todoId, startedAt）
        if (method === 'GET' && path.includes('/time-entries/active')) {
            console.log('🟢 現在の計測エントリ取得中...');
            const userId = event.queryStringParameters?.userId;
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId query parameter is required' })
                };
            }
            let client = null;
            try {
                client = await connectToDatabase();
                const result = await client.query(
                    'SELECT te."todoId", te."startedAt", t.title as "todoTitle" FROM "TimeEntry" te LEFT JOIN "Todo" t ON te."todoId" = t.id WHERE te."userId" = $1 AND te."endedAt" IS NULL LIMIT 1',
                    [userId]
                );
                if (result.rows.length === 0) {
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ running: false })
                    };
                }
                const row = result.rows[0];
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ running: true, todoId: row.todoId?.toString() || null, startedAt: row.startedAt, title: row.todoTitle || null })
                };
            } catch (error) {
                console.error('❌ 現在の計測エントリ取得エラー:', error);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ running: false })
                };
            } finally {
                if (client) client.release();
            }
        }

        // GET /time-entries/analytics - 時間分析データ取得（TZ対応: 日付・時間帯の境界をTZに合わせる）
        if (method === 'GET' && path.includes('/time-entries/analytics')) {
            console.log('📈 時間分析データ取得中...');
            
            const userId = event.queryStringParameters?.userId;
            const days = parseInt(event.queryStringParameters?.days) || 30;
            const tz = event.queryStringParameters?.tz || 'UTC';
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId query parameter is required' })
                };
            }
            
            let client = null;
            try {
                client = await connectToDatabase();
                
                // TZオフセットに基づく期間開始（選択TZの00:00を境界に算出→UTCに戻す）
                const offsetMinutes = tz === 'Asia/Tokyo' ? 9 * 60 : 0;
                const nowUtc = new Date();
                const nowShifted = new Date(nowUtc.getTime() + offsetMinutes * 60 * 1000);
                const startShifted = new Date(nowShifted);
                startShifted.setDate(startShifted.getDate() - days);
                startShifted.setHours(0, 0, 0, 0);
                const startDate = new Date(startShifted.getTime() - offsetMinutes * 60 * 1000);
                
                // 日別統計
                const dailyStatsResult = await client.query(`
                    SELECT 
                        DATE("startedAt" + ($3 || ' minutes')::interval) as date,
                        COALESCE(SUM(duration), 0) as seconds
                    FROM "TimeEntry" 
                    WHERE "userId" = $1 
                        AND "startedAt" >= $2 
                        AND "endedAt" IS NOT NULL
                    GROUP BY DATE("startedAt" + ($3 || ' minutes')::interval)
                    ORDER BY date
                `, [userId, startDate, String(offsetMinutes)]);
                
                // タスク別統計
                const taskStatsResult = await client.query(`
                    SELECT 
                        t."todoId",
                        todo.title as "taskTitle",
                        CASE WHEN todo.completed THEN 'completed' ELSE 'pending' END as "taskStatus",
                        COALESCE(todo.category, 'uncategorized') as "taskCategory",
                        COALESCE(SUM(t.duration), 0) as "totalSeconds",
                        COUNT(*) as sessions,
                        COALESCE(AVG(t.duration), 0) as "avgSessionTime"
                    FROM "TimeEntry" t
                    LEFT JOIN "Todo" todo ON t."todoId" = todo.id
                    WHERE t."userId" = $1 
                        AND t."startedAt" >= $2 
                        AND t."endedAt" IS NOT NULL
                        AND t."todoId" IS NOT NULL
                    GROUP BY t."todoId", todo.title, todo.completed, todo.category
                    ORDER BY "totalSeconds" DESC
                `, [userId, startDate]);
                
                // 総作業時間
                const totalResult = await client.query(`
                    SELECT COALESCE(SUM(duration), 0) as total
                    FROM "TimeEntry" 
                    WHERE "userId" = $1 
                        AND "startedAt" >= $2 
                        AND "endedAt" IS NOT NULL
                `, [userId, startDate]);
                
                const totalSeconds = parseInt(totalResult.rows[0].total, 10);
                const dailyStats = dailyStatsResult.rows.map(row => ({
                    date: row.date.toISOString().split('T')[0],
                    seconds: parseInt(row.seconds, 10)
                }));
                
                const taskStats = taskStatsResult.rows.map(row => ({
                    taskId: row.todoId?.toString() || 'unknown',
                    taskTitle: row.taskTitle || 'Unknown Task',
                    taskStatus: row.taskStatus,
                    taskCategory: row.taskCategory,
                    totalSeconds: parseInt(row.totalSeconds, 10),
                    sessions: parseInt(row.sessions, 10),
                    avgSessionTime: parseFloat(row.avgSessionTime) || 0,
                    efficiency: Math.min(100, Math.max(0, (parseFloat(row.avgSessionTime) || 0) / 1800 * 100)) // 30分基準
                }));
                
                // 週平均とベスト/ワーストデイの計算
                const weeklyAverage = dailyStats.length > 0 ? totalSeconds / Math.ceil(days / 7) : 0;
                const bestDay = dailyStats.length > 0 ? 
                    dailyStats.reduce((best, day) => day.seconds > best.seconds ? day : best).date : '記録なし';
                const worstDay = dailyStats.length > 0 ? 
                    dailyStats.reduce((worst, day) => day.seconds < worst.seconds ? day : worst).date : '記録なし';
                const avgSeconds = dailyStats.length > 0 ? totalSeconds / dailyStats.length : 0;
                const consistency = dailyStats.length > 1 && avgSeconds > 0 ? 
                    Math.max(0, 100 - (Math.sqrt(dailyStats.reduce((acc, day) => 
                        acc + Math.pow(day.seconds - avgSeconds, 2), 0) / dailyStats.length) / avgSeconds) * 100) : 0;
                
                const analytics = {
                    totalSeconds,
                    dailyStats,
                    taskStats,
                    weeklyAverage: Math.round(weeklyAverage),
                    productivity: {
                        bestDay,
                        worstDay,
                        consistency: Math.round(consistency)
                    }
                };
                
                console.log(`✅ 時間分析データ取得完了: ${totalSeconds}秒, ${dailyStats.length}日分`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(analytics)
                };
                
            } catch (error) {
                console.error('❌ 時間分析データ取得エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }

        // GET /time-entries/tasks - タスク別時間統計取得（時間帯はTZ考慮）
        if (method === 'GET' && path.includes('/time-entries/tasks')) {
            console.log('📊 タスク別時間統計取得中...');
            
            const userId = event.queryStringParameters?.userId;
            const limit = parseInt(event.queryStringParameters?.limit) || 10;
            const sortBy = event.queryStringParameters?.sortBy || 'totalTime';
            const tz = event.queryStringParameters?.tz || 'UTC';
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId query parameter is required' })
                };
            }
            
            let client = null;
            try {
                client = await connectToDatabase();
                
                // タスク別統計
                const sortColumn = sortBy === 'sessions' ? 'COUNT(*)' : 'COALESCE(SUM(t.duration), 0)';
                const taskStatsResult = await client.query(`
                    SELECT 
                        t."todoId",
                        todo.title as "taskTitle",
                        CASE WHEN todo.completed THEN 'completed' ELSE 'pending' END as "taskStatus",
                        COALESCE(todo.category, 'uncategorized') as "taskCategory",
                        COALESCE(SUM(t.duration), 0) as "totalSeconds",
                        COUNT(*) as sessions,
                        COALESCE(AVG(t.duration), 0) as "avgSessionTime"
                    FROM "TimeEntry" t
                    LEFT JOIN "Todo" todo ON t."todoId" = todo.id
                    WHERE t."userId" = $1 
                        AND t."endedAt" IS NOT NULL
                        AND t."todoId" IS NOT NULL
                    GROUP BY t."todoId", todo.title, todo.completed, todo.category
                    ORDER BY ${sortColumn} DESC
                    LIMIT $2
                `, [userId, limit]);
                
                // 時間別生産性（24時間）
                // TZオフセット（分）を用いて時刻をシフトし時間帯別に集計
                const offsetMinutes = tz === 'Asia/Tokyo' ? 9 * 60 : 0;
                const hourlyResult = await client.query(`
                    SELECT 
                        CAST(EXTRACT(HOUR FROM ("startedAt" + ($2 || ' minutes')::interval)) AS INT) as hour,
                        COALESCE(SUM(duration), 0) as seconds
                    FROM "TimeEntry" 
                    WHERE "userId" = $1 
                        AND "endedAt" IS NOT NULL
                    GROUP BY 1
                    ORDER BY 1
                `, [userId, String(offsetMinutes)]);
                
                // 総統計
                const totalStatsResult = await client.query(`
                    SELECT 
                        COUNT(DISTINCT "todoId") as "totalTasks",
                        COUNT(DISTINCT CASE WHEN "todoId" IS NOT NULL THEN "todoId" END) as "workedTasks",
                        COALESCE(SUM(duration), 0) as "totalWorkTime",
                        COUNT(*) as "totalSessions"
                    FROM "TimeEntry" 
                    WHERE "userId" = $1 
                        AND "endedAt" IS NOT NULL
                `, [userId]);
                
                const taskStats = taskStatsResult.rows.map(row => ({
                    taskId: row.todoId?.toString() || 'unknown',
                    taskTitle: row.taskTitle || 'Unknown Task',
                    taskStatus: row.taskStatus,
                    taskCategory: row.taskCategory,
                    totalSeconds: parseInt(row.totalSeconds, 10),
                    sessions: parseInt(row.sessions, 10),
                    avgSessionTime: parseFloat(row.avgSessionTime) || 0,
                    efficiency: Math.min(100, Math.max(0, (parseFloat(row.avgSessionTime) || 0) / 1800 * 100)) // 30分基準
                }));
                
                const hourlyProductivity = hourlyResult.rows.map(row => ({
                    hour: parseInt(row.hour, 10),
                    seconds: parseInt(row.seconds, 10)
                }));
                
                const mostProductiveHour = hourlyProductivity.length > 0 ?
                    hourlyProductivity.reduce((best, hour) => hour.seconds > best.seconds ? hour : best) :
                    { hour: 9, seconds: 0 };
                
                const totalStats = totalStatsResult.rows[0] || {};
                
                const result = {
                    taskStats,
                    totalTasks: parseInt(totalStats.totalTasks, 10) || 0,
                    workedTasks: parseInt(totalStats.workedTasks, 10) || 0,
                    totalWorkTime: parseInt(totalStats.totalWorkTime, 10) || 0,
                    totalSessions: parseInt(totalStats.totalSessions, 10) || 0,
                    hourlyProductivity,
                    mostProductiveHour
                };
                
                console.log(`✅ タスク別統計取得完了: ${taskStats.length}タスク`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(result)
                };
                
            } catch (error) {
                console.error('❌ タスク別統計取得エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }

        // GET /time-entries/goals - 時間目標取得  
        if (method === 'GET' && path.includes('/time-entries/goals')) {
            console.log('🎯 時間目標取得中...');
            
            const userId = event.queryStringParameters?.userId;
            
            if (!userId) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId query parameter is required' })
                };
            }
            
            let client = null;
            try {
                client = await connectToDatabase();
                
                const result = await client.query(
                    'SELECT * FROM "TimeGoal" WHERE "userId" = $1 ORDER BY "createdAt" DESC',
                    [userId]
                );
                
                console.log(`✅ 時間目標取得完了: ${result.rows.length}件`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(result.rows)
                };
                
            } catch (error) {
                console.error('❌ 時間目標取得エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: error.message, rows: [] })
                };
            } finally {
                if (client) client.release();
            }
        }

        // POST /time-entries/goals - 時間目標設定
        if (method === 'POST' && path.includes('/time-entries/goals')) {
            console.log('🎯 時間目標設定中...');
            
            let body;
            try {
                if (typeof event.body === 'string') {
                    body = JSON.parse(event.body);
                } else {
                    body = event.body;
                }
            } catch (jsonError) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'Invalid JSON format in request body' })
                };
            }
            
            const { userId, goalType, targetMinutes, description } = body;
            
            if (!userId || !goalType || !targetMinutes) {
                return {
                    statusCode: 400,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: 'userId, goalType, and targetMinutes are required' })
                };
            }
            
            let client = null;
            try {
                client = await connectToDatabase();
                
                // 既存の同じタイプの目標があれば更新、なければ作成
                const existingResult = await client.query(
                    'SELECT id FROM "TimeGoal" WHERE "userId" = $1 AND "goalType" = $2',
                    [userId, goalType]
                );
                
                let result;
                if (existingResult.rows.length > 0) {
                    // 更新
                    result = await client.query(
                        'UPDATE "TimeGoal" SET "targetMinutes" = $1, description = $2, "updatedAt" = NOW() WHERE "userId" = $3 AND "goalType" = $4 RETURNING *',
                        [targetMinutes, description, userId, goalType]
                    );
                } else {
                    // 新規作成
                    result = await client.query(
                        'INSERT INTO "TimeGoal" ("userId", "goalType", "targetMinutes", description, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *',
                        [userId, goalType, targetMinutes, description]
                    );
                }
                
                console.log(`✅ 時間目標設定完了: ${goalType} - ${targetMinutes}分`);
                
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(result.rows[0])
                };
                
            } catch (error) {
                console.error('❌ 時間目標設定エラー:', error);
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ error: error.message })
                };
            } finally {
                if (client) client.release();
            }
        }


        // 未知のエンドポイント
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Endpoint not found',
                method: method,
                path: path,
                availableEndpoints: [
                    'GET / - ヘルスチェック + PostgreSQL接続テスト',
                    'GET /todos - 全Todo取得',
                    'GET /todos/user/{userId} - ユーザー専用Todo取得（高速）',
                    'POST /todos - Todo作成',
                    'PUT /todos/:id - Todo更新',
                    'DELETE /todos/:id - Todo削除',
                    'POST /auth/register - ユーザー登録',
                    'POST /auth/login - ユーザーログイン',
                    'POST /import-todos - Todoデータインポート',
                    'POST /auth/change-password - パスワード変更',
                    'POST /auth/update-user - ユーザー情報更新',
                    'POST /auth/delete-account - アカウント削除',
                    'GET /saved-searches/user/{userId} - 保存済み検索取得',
                    'POST /saved-searches - 保存済み検索作成',
                    'DELETE /saved-searches/{id} - 保存済み検索削除',
                    'POST /time-entries/start - 時間計測開始',
                    'POST /time-entries/stop - 時間計測停止',
                    'GET /time-entries/summary?userId={userId} - 時間サマリ取得',
                    'GET /time-entries/analytics?userId={userId}&days={days} - 時間分析データ取得',
                    'GET /time-entries/tasks?userId={userId}&limit={limit}&sortBy={sortBy} - タスク別統計取得',
                    'GET /time-entries/goals?userId={userId} - 時間目標取得',
                    'POST /time-entries/goals - 時間目標設定'
                ]
            })
        };

    } catch (error) {
        console.error('💥 Lambda関数エラー:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};


/**
 * 本番環境デプロイ前のセキュリティチェックリスト
 *
 * [ ] 1. 認証・認可
 *     [ ] API Gateway での認証設定（JWT/Cognito）
 *     [ ] リクエストごとのユーザー検証
 *     [ ] ロールベースアクセス制御（RBAC）
 *
 * [ ] 2. 機密情報管理
 *     [ ] AWS Secrets Manager でのDB認証情報管理
 *     [ ] 環境変数からの機密情報削除
 *     [ ] CloudWatch Logsでの機密情報マスク
 *
 * [ ] 3. ネットワークセキュリティ
 *     [ ] VPC内でのLambda実行
 *     [ ] セキュリティグループの最小権限設定
 *     [ ] NACLsの設定
 *     [ ] データベースへのパブリックアクセス禁止
 *
 * [ ] 4. 入力検証
 *     [ ] すべてのユーザー入力のバリデーション
 *     [ ] パラメータ化クエリの使用（SQLインジェクション対策）
 *     [ ] XSS対策のサニタイズ
 *     [ ] ファイルアップロードの検証
 *
 * [ ] 5. レート制限
 *     [ ] API Gateway のレート制限設定
 *     [ ] ログイン試行回数制限
 *     [ ] アカウントロックアウト機能
 *
 * [ ] 6. 暗号化
 *     [ ] 通信の暗号化（HTTPS/TLS）
 *     [ ] データベース暗号化（at-rest）
 *     [ ] S3バケット暗号化
 *
 * [ ] 7. 監視・ログ
 *     [ ] CloudWatch Logsの有効化
 *     [ ] CloudWatch Alarmsの設定
 *     [ ] AWS CloudTrailの有効化
 *     [ ] 異常検知アラートの設定
 *
 * [ ] 8. IAMとアクセス制御
 *     [ ] 最小権限の原則に基づいたIAMロール
 *     [ ] MFAの有効化
 *     [ ] アクセスキーのローテーション
 *
 * [ ] 9. コンプライアンス
 *     [ ] GDPR準拠（該当する場合）
 *     [ ] データ保持ポリシーの実装
 *     [ ] プライバシーポリシーの更新
 *
 * [ ] 10. テスト
 *     [ ] セキュリティスキャン実施
 *     [ ] ペネトレーションテスト
 *     [ ] 負荷テスト
 */
