declare namespace NodeJS {
  interface ProcessEnv {
    // Lambda API関連
    LAMBDA_API_URL: string;
    NEXT_PUBLIC_LAMBDA_API_URL: string;
    
    // RDS関連（従来のDirect接続用）
    DATABASE_URL: string;
    
    // NextAuth関連
    NEXTAUTH_URL: string;
    NEXTAUTH_SECRET: string;
    
    // OAuth プロバイダー
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    
    // その他
    NODE_ENV: 'development' | 'production' | 'test';
    VERCEL_URL?: string;
    // インポート並列度
    IMPORT_CONCURRENCY?: string;
  }
}

// クライアントサイドで使用可能な環境変数
interface PublicEnv {
  NEXT_PUBLIC_LAMBDA_API_URL: string;
}

// 環境変数のバリデーション関数
export function validateEnv(): void {
  const requiredEnvVars = [
    'LAMBDA_API_URL',
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET'
  ] as const;

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
}

// 安全に環境変数を取得するヘルパー関数
export function getEnv(key: keyof NodeJS.ProcessEnv, defaultValue?: string): string {
  const value = process.env[key];
  
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not defined`);
  }
  
  return value;
}

// パブリック環境変数を安全に取得
export function getPublicEnv(): PublicEnv {
  return {
    NEXT_PUBLIC_LAMBDA_API_URL: getEnv(
      'NEXT_PUBLIC_LAMBDA_API_URL', 
      'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod'
    ),
  };
}
