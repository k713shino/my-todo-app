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

// Component Props types
export interface LambdaConnectionTestProps {
  className?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}