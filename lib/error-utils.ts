/**
 * エラーハンドリングユーティリティ
 * 
 * ユーザーフレンドリーなエラーメッセージの生成とリトライ機能を提供
 */

export interface ErrorWithStatus extends Error {
  status?: number;
  statusText?: string;
}

export interface RetryOptions {
  maxRetries?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * エラーステータスコードに基づいてユーザーフレンドリーなメッセージを生成
 */
export function getErrorMessage(error: ErrorWithStatus): string {
  const status = error.status;
  
  // ネットワークエラー
  if (!status) {
    if (error.name === 'AbortError') {
      return '⏱️ リクエストがタイムアウトしました。しばらく待ってから再試行してください。';
    }
    if (error.message.includes('fetch')) {
      return '🌐 ネットワークに接続できませんでした。インターネット接続を確認してください。';
    }
    return '❌ 予期しないエラーが発生しました。しばらく待ってから再試行してください。';
  }

  // HTTPステータスコード別メッセージ
  switch (status) {
    case 400:
      return '📝 入力内容に不備があります。内容を確認して再試行してください。';
    case 401:
      return '🔐 認証が必要です。ページを再読み込みしてサインインし直してください。';
    case 403:
      return '🚫 この操作を実行する権限がありません。';
    case 404:
      return '🔍 指定されたデータが見つかりませんでした。';
    case 409:
      return '⚠️ データが競合しています。ページを更新して最新の状態を確認してください。';
    case 429:
      return '🕐 リクエストが多すぎます。しばらく待ってから再試行してください。';
    case 500:
      return '🛠️ サーバーで問題が発生しています。しばらく待ってから再試行してください。';
    case 502:
    case 503:
    case 504:
      return '⚙️ サービスが一時的に利用できません。しばらく待ってから再試行してください。';
    default:
      return `❌ エラーが発生しました (${status})。しばらく待ってから再試行してください。`;
  }
}

/**
 * 特定のエラーが一時的なものかどうかを判定
 */
export function isTemporaryError(error: ErrorWithStatus): boolean {
  const status = error.status;
  
  // ネットワークエラーは一時的
  if (!status) {
    return true;
  }
  
  // 一時的なHTTPエラー
  const temporaryStatusCodes = [408, 429, 500, 502, 503, 504];
  return temporaryStatusCodes.includes(status);
}

/**
 * 指数バックオフによるリトライ機能
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = isTemporaryError
  } = options;

  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // 最後の試行または再試行すべきでないエラーの場合は終了
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      // 指数バックオフで待機
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);
      console.log(`🔄 リトライ ${attempt + 1}/${maxRetries} in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * キャッシュフォールバック付きの操作
 */
export async function withCacheFallback<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T | null>,
  _errorMessage: string = 'データの取得に失敗しました'
): Promise<T> {
  try {
    return await primaryOperation();
  } catch (error) {
    console.warn('Primary operation failed, trying fallback:', error);
    
    try {
      const fallbackResult = await fallbackOperation();
      if (fallbackResult !== null) {
        return fallbackResult;
      }
    } catch (fallbackError) {
      console.error('Fallback operation also failed:', fallbackError);
    }
    
    // 両方失敗した場合はユーザーフレンドリーなエラーを投げる
    const friendlyError = new Error(getErrorMessage(error as ErrorWithStatus));
    throw friendlyError;
  }
}

/**
 * Lambda APIエラーの詳細ログ
 */
export function logApiError(error: ErrorWithStatus, context: string): void {
  console.error(`❌ ${context} failed:`, {
    message: error.message,
    status: error.status,
    statusText: error.statusText,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
}

/**
 * エラー通知用のトースト表示ヘルパー
 */
export interface ToastErrorOptions {
  title?: string;
  duration?: number;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

export function createErrorToast(
  error: ErrorWithStatus, 
  options: ToastErrorOptions = {}
): { message: string; type: 'error'; duration: number } {
  const message = options.title 
    ? `${options.title}: ${getErrorMessage(error)}`
    : getErrorMessage(error);
    
  return {
    message,
    type: 'error',
    duration: options.duration || 5000
  };
}