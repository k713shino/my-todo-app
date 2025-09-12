// API関連のユーティリティ関数とエラーハンドリング

// カスタム API エラークラス
// HTTPステータスコードとメッセージを含む詳細なエラー情報を保持
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public statusText?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// APIError型ガード関数
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

// エラー情報を日本語メッセージに変換する関数
export function handleAPIError(error: unknown): string {
  if (isAPIError(error)) {
    return `API Error (${error.status}): ${error.message}`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Unknown error occurred';
}

// API レスポンスの型ガード関数

// 成功レスポンス型ガード
export function isSuccessResponse<T>(
  response: any
): response is { success: true; data: T } {
  return response && response.success === true && 'data' in response;
}

// エラーレスポンス型ガード
export function isErrorResponse(
  response: any
): response is { success: false; error: string } {
  return response && response.success === false && 'error' in response;
}