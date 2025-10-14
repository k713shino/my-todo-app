const { Pool } = require('pg');
const fs = require('fs');
const https = require('https');

// RDS CA証明書のダウンロードとキャッシュ
async function downloadRDSCertificate() {
    const certPath = '/tmp/rds-ca-2019-root.pem';
    
    // 既にファイルが存在する場合はそれを使用
    if (fs.existsSync(certPath)) {
        console.log('✅ RDS CA証明書: キャッシュから使用');
        return certPath;
    }
    
    console.log('📥 RDS CA証明書をダウンロード中...');
    
    const certUrl = 'https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem';
    
    return new Promise((resolve, reject) => {
        https.get(certUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`証明書ダウンロード失敗: ${response.statusCode}`));
                return;
            }
            
            let data = '';
            response.on('data', (chunk) => {
                data += chunk;
            });
            
            response.on('end', () => {
                try {
                    // 証明書をファイルにキャッシュ
                    fs.writeFileSync(certPath, data);
                    console.log('✅ RDS CA証明書ダウンロード完了');
                    resolve(certPath);
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// DATABASE_URLをパースする関数
function parseDatabaseUrl(databaseUrl) {
    try {
        const url = new URL(databaseUrl);
        return {
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            user: url.username,
            password: url.password,
            database: url.pathname.substring(1), // remove leading slash
            ssl: url.searchParams.get('sslmode') !== 'disable'
        };
    } catch (error) {
        console.error('❌ DATABASE_URL parse error:', error.message);
        throw new Error('Invalid DATABASE_URL format');
    }
}

// 最適化されたPostgreSQL接続設定
async function createOptimizedPgConfig() {
    let config;
    
    // DATABASE_URL または個別環境変数から設定を構築
    if (process.env.DATABASE_URL) {
        console.log('🔗 Using DATABASE_URL for connection');
        config = parseDatabaseUrl(process.env.DATABASE_URL);
    } else {
        console.log('🔗 Using individual environment variables for connection');
        config = {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: process.env.SSL_MODE !== 'disable'
        };
    }

    // 基本設定
    const baseConfig = {
        ...config,
        max: 1, // Lambda環境では接続プールサイズを制限
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
        statement_timeout: 30000,
        query_timeout: 30000,
        application_name: 'todo-app-lambda'
    };

    // SSL設定の最適化
    if (baseConfig.ssl && process.env.SSL_MODE === 'strict') {
        try {
            const certPath = await downloadRDSCertificate();
            baseConfig.ssl = {
                rejectUnauthorized: true,
                ca: fs.readFileSync(certPath),
                checkServerIdentity: () => { return null; } // AWS RDS用の設定
            };
            console.log('🔐 SSL設定: 厳格モード (CA証明書検証あり)');
        } catch (error) {
            console.warn('⚠️ CA証明書取得失敗、基本SSLにフォールバック:', error.message);
            baseConfig.ssl = { rejectUnauthorized: false };
            console.log('🔐 SSL設定: 基本モード (CA証明書検証なし)');
        }
    } else if (baseConfig.ssl) {
        // デフォルトは基本SSL設定
        baseConfig.ssl = { rejectUnauthorized: false };
        console.log('🔐 SSL設定: 基本モード (CA証明書検証なし)');
    } else {
        console.log('🔐 SSL設定: 無効');
    }

    return baseConfig;
}

module.exports = {
    createOptimizedPgConfig,
    downloadRDSCertificate,
    parseDatabaseUrl
};