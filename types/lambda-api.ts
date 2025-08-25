export interface LambdaAPIResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface RDSConnectionResponse {
  message: string;
  time: {
    current_time: string;
  };
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  userId: string;
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
}

// ユーザー認証関連の型定義
export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegisterUserRequest {
  name?: string;
  email: string;
  password: string;
}

export interface LoginUserRequest {
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export interface RegisterUserResponse {
  user: User;
  message: string;
}

export interface LoginUserResponse {
  user: User;
  token?: string;
  message: string;
}

export interface UserStatsResponse {
  totalTodos: number;
  completedTodos: number;
  pendingTodos: number;
  completionRate: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
}

export interface AuthMethodsResponse {
  methods: Array<{
    type: 'email' | 'oauth';
    provider?: string;
    verified: boolean;
  }>;
}

// SavedSearch関連の型定義
export interface SavedSearch {
  id: string;
  name: string;
  filters: string;
  userId: string;
  createdAt: string;
}

export interface CreateSavedSearchRequest {
  name: string;
  filters: string;
  userId: string;
}

// Lambda DB専用レスポンス型
export interface LambdaResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  httpStatus?: number;
  details?: string;
}

export interface BatchUpdateRequest {
  updates: Array<{
    id: string;
    data: Partial<Todo>;
  }>;
}

export interface LambdaAPIError extends Error {
  status?: number;
  statusText?: string;
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
}

export interface APIEndpoints {
  testConnection: '/';
  todos: '/todos';
  todoById: (todoId: string) => string;
}

// Vercel API Response types
export interface VercelAPIResponse<T = any> {
  success: boolean;
  message?: string;
  lambdaResponse?: T;
  error?: string;
  timestamp: string;
}

