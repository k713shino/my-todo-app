import type {
  LambdaAPIResponse,
  RDSConnectionResponse,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  LambdaAPIError,
  RequestOptions,
} from '../types/lambda-api';

export class LambdaAPI {
  private readonly baseURL: string;
  private readonly defaultTimeout: number = 30000; // 30秒

  constructor() {
    this.baseURL = process.env.LAMBDA_API_URL || 
      'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod';
  }

  /**
   * Lambda APIに対してHTTPリクエストを送信
   */
  async request<T = any>(
    endpoint: string = '',
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const timeout = options.timeout || this.defaultTimeout;

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const finalOptions: RequestInit = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    // タイムアウト制御
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`🚀 Lambda API呼び出し: ${url}`, finalOptions);
      
      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        const error: LambdaAPIError = new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
        error.status = response.status;
        error.statusText = response.statusText;
        throw error;
      }

      const data: T = await response.json();
      console.log(`✅ Lambda APIレスポンス:`, data);
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        console.error(`❌ Lambda API呼び出しエラー:`, error);
      }
      throw error;
    }
  }

  /**
   * RDS接続テスト
   */
  async testConnection(): Promise<RDSConnectionResponse> {
    return await this.request<RDSConnectionResponse>('/', { 
      method: 'GET' 
    });
  }

  /**
   * 全てのTodoを取得
   */
  async getTodos(): Promise<Todo[]> {
    return await this.request<Todo[]>('/todos', { 
      method: 'GET' 
    });
  }

  /**
   * 特定のTodoを取得
   */
  async getTodoById(id: string): Promise<Todo> {
    if (!id) {
      throw new Error('Todo ID is required');
    }
    return await this.request<Todo>(`/todos/${id}`, { 
      method: 'GET' 
    });
  }

  /**
   * 新しいTodoを作成
   */
  async createTodo(todo: CreateTodoRequest): Promise<Todo> {
    if (!todo.title || !todo.userId) {
      throw new Error('Title and userId are required');
    }
    return await this.request<Todo>('/todos', {
      method: 'POST',
      body: JSON.stringify(todo),
    });
  }

  /**
   * Todoを更新
   */
  async updateTodo(id: string, todo: UpdateTodoRequest): Promise<Todo> {
    if (!id) {
      throw new Error('Todo ID is required');
    }
    return await this.request<Todo>(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(todo),
    });
  }

  /**
   * Todoを削除
   */
  async deleteTodo(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new Error('Todo ID is required');
    }
    return await this.request(`/todos/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * ユーザーのTodoを取得
   */
  async getUserTodos(userId: string): Promise<Todo[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return await this.request<Todo[]>(`/todos/user/${userId}`, { 
      method: 'GET' 
    });
  }

  /**
   * Todoの完了状態を切り替え
   */
  async toggleTodoComplete(id: string): Promise<Todo> {
    if (!id) {
      throw new Error('Todo ID is required');
    }
    return await this.request<Todo>(`/todos/${id}/toggle`, {
      method: 'PATCH',
    });
  }

  /**
   * 汎用GETリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async get<T = any>(endpoint: string): Promise<LambdaAPIResponse<T>> {
    try {
      const response = await this.request<T>(endpoint, { method: 'GET' });
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 汎用POSTリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async post<T = any>(endpoint: string, data: any): Promise<LambdaAPIResponse<T>> {
    try {
      const response = await this.request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 汎用PUTリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async put<T = any>(endpoint: string, data: any): Promise<LambdaAPIResponse<T>> {
    try {
      const response = await this.request<T>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 汎用DELETEリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async delete<T = any>(endpoint: string): Promise<LambdaAPIResponse<T>> {
    try {
      const response = await this.request<T>(endpoint, {
        method: 'DELETE',
      });
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// シングルトンインスタンス
export const lambdaAPI = new LambdaAPI();

// ヘルパー関数
export const isLambdaAPIError = (error: unknown): error is LambdaAPIError => {
  return error instanceof Error && 'status' in error;
};

export const formatLambdaAPIError = (error: unknown): string => {
  if (isLambdaAPIError(error)) {
    return `API Error (${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
};