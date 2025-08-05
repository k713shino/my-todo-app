import type { LambdaAPIError } from '@/types/lambda-api';

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

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

export function handleAPIError(error: unknown): string {
  if (isAPIError(error)) {
    return `API Error (${error.status}): ${error.message}`;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Unknown error occurred';
}

// レスポンスの型ガード
export function isSuccessResponse<T>(
  response: any
): response is { success: true; data: T } {
  return response && response.success === true && 'data' in response;
}

export function isErrorResponse(
  response: any
): response is { success: false; error: string } {
  return response && response.success === false && 'error' in response;
}