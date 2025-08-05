export const API_ENDPOINTS = {
  LAMBDA_TEST: '/api/lambda-test',
  TODOS: '/api/todos',
  TODO_BY_ID: (id: string) => `/api/todos/${id}`,
} as const;

export const LAMBDA_ENDPOINTS = {
  ROOT: '/',
  TODOS: '/todos',
  TODO_BY_ID: (id: string) => `/todos/${id}`,
  USER_TODOS: (userId: string) => `/todos/user/${userId}`,
  TOGGLE_TODO: (id: string) => `/todos/${id}/toggle`,
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'ネットワークエラーが発生しました',
  SERVER_ERROR: 'サーバーエラーが発生しました',
  VALIDATION_ERROR: '入力内容に問題があります',
  NOT_FOUND: 'データが見つかりませんでした',
  UNAUTHORIZED: '認証が必要です',
  FORBIDDEN: 'アクセス権限がありません',
} as const;

export const SUCCESS_MESSAGES = {
  TODO_CREATED: 'Todoを作成しました',
  TODO_UPDATED: 'Todoを更新しました',
  TODO_DELETED: 'Todoを削除しました',
  CONNECTION_SUCCESS: 'Lambda APIに正常に接続できました',
} as const;