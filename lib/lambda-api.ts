import type {
  LambdaAPIResponse,
  RDSConnectionResponse,
  Todo,
  CreateTodoRequest,
  UpdateTodoRequest,
  LambdaAPIError,
  RequestOptions,
  User,
  RegisterUserRequest,
  LoginUserRequest,
  UpdateUserRequest,
  RegisterUserResponse,
  LoginUserResponse,
  SavedSearch,
  CreateSavedSearchRequest,
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
      console.log(`🚀🟠 === Lambda API request START ===`);
      console.log(`🟠1️⃣ URL: ${url}`);
      console.log('🟠2️⃣ Request details:', {
        method: finalOptions.method || 'GET',
        headers: finalOptions.headers,
        body: finalOptions.body ? JSON.parse(finalOptions.body as string) : null,
        timeout: timeout
      });
      
      console.log('🟠3️⃣ Making fetch request...');
      const response = await fetch(url, {
        ...finalOptions,
        signal: controller.signal,
      });
      
      console.log('🟠4️⃣ Fetch completed, HTTP response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url,
        type: response.type,
        redirected: response.redirected
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log('🟠5️⃣ Response not OK, reading error text...');
        const errorText = await response.text();
        console.log('🟠❌ Error text:', errorText);
        
        const error: LambdaAPIError = new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
        error.status = response.status;
        error.statusText = response.statusText;
        
        console.log('🟠❌ Throwing HTTP error:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText
        });
        throw error;
      }

      console.log('🟠6️⃣ Response OK, parsing JSON...');
      const data: T = await response.json();
      console.log(`🟠✅ Lambda API response parsed:`, data);
      
      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      
      console.error('🟠💥 Lambda API request catch block:', {
        error,
        errorType: typeof error,
        errorConstructor: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : 'No stack',
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.log('🟠💥 Request timeout detected');
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        console.error(`🟠💥 Lambda API error:`, error);
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
   * ユーザー登録
   */
  async registerUser(userData: RegisterUserRequest): Promise<RegisterUserResponse> {
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }
    if (userData.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
      throw new Error('Valid email address is required');
    }

    return await this.request<RegisterUserResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: userData.name?.trim() || null,
        email: userData.email.toLowerCase().trim(),
        password: userData.password,
      }),
    });
  }

  /**
   * ユーザーログイン
   */
  async loginUser(credentials: LoginUserRequest): Promise<LoginUserResponse> {
    if (!credentials.email || !credentials.password) {
      throw new Error('Email and password are required');
    }

    return await this.request<LoginUserResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: credentials.email.toLowerCase().trim(),
        password: credentials.password,
      }),
    });
  }

  /**
   * ユーザー情報取得
   */
  async getUser(userId: string): Promise<User> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return await this.request(`/users/${userId}`, {
      method: 'GET',
    });
  }

  /**
   * メールアドレスでユーザー検索
   */
  async getUserByEmail(email: string): Promise<User> {
    if (!email) {
      throw new Error('Email is required');
    }
    return await this.request(`/users/email/${encodeURIComponent(email)}`, {
      method: 'GET',
    });
  }

  /**
   * ユーザー情報更新
   */
  async updateUser(userId: string, updateData: UpdateUserRequest): Promise<User> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return await this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  }

  /**
   * ユーザー削除
   */
  async deleteUser(userId: string): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return await this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  /**
   * ユーザーの保存済み検索一覧を取得
   */
  async getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
    if (!userId) {
      throw new Error('User ID is required');
    }
    return await this.request<SavedSearch[]>(`/saved-searches/user/${encodeURIComponent(userId)}`, { 
      method: 'GET' 
    });
  }

  /**
   * 新しい保存済み検索を作成
   */
  async createSavedSearch(savedSearchData: CreateSavedSearchRequest): Promise<SavedSearch> {
    if (!savedSearchData.name || !savedSearchData.userId) {
      throw new Error('Name and userId are required');
    }
    return await this.request<SavedSearch>('/saved-searches', {
      method: 'POST',
      body: JSON.stringify(savedSearchData),
    });
  }

  /**
   * 保存済み検索を削除
   */
  async deleteSavedSearch(id: string): Promise<{ success: boolean; message: string }> {
    if (!id) {
      throw new Error('SavedSearch ID is required');
    }
    return await this.request(`/saved-searches/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 汎用GETリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<LambdaAPIResponse<T>> {
    try {
      const response = await this.request<T>(endpoint, { method: 'GET', ...options });
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
    console.log('🚀🔵 === Lambda API POST START ===', { endpoint, data });
    
    try {
      console.log('🔵1️⃣ Calling this.request...');
      
      const response = await this.request<T>(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      console.log('🔵2️⃣ Lambda API request successful, response:', response);
      
      const successResponse = {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
      
      console.log('🔵3️⃣ Returning success response:', successResponse);
      return successResponse;
      
    } catch (error) {
      console.error('🚨🔴 Lambda API POST error caught:', {
        endpoint,
        data,
        errorType: typeof error,
        errorConstructor: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : 'No stack',
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
      
      const errorResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        debugInfo: {
          errorType: error instanceof Error ? error.constructor.name : typeof error,
          errorName: error instanceof Error ? error.name : 'Unknown',
          endpoint,
          data
        }
      };
      
      console.log('🔴📤 Returning error response:', errorResponse);
      return errorResponse;
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

  /**
   * 汎用ユーザー登録リクエスト（VercelAPIResponse形式の戻り値用）
   */
  async registerUserWrapped(userData: RegisterUserRequest): Promise<LambdaAPIResponse<RegisterUserResponse>> {
    try {
      const response = await this.registerUser(userData);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User registration failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 汎用ユーザーログインリクエスト（VercelAPIResponse形式の戻り値用）
   */
  async loginUserWrapped(credentials: LoginUserRequest): Promise<LambdaAPIResponse<LoginUserResponse>> {
    try {
      const response = await this.loginUser(credentials);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User login failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 汎用ユーザー取得リクエスト（VercelAPIResponse形式の戻り値用）
   */
  async getUserWrapped(userId: string): Promise<LambdaAPIResponse<User>> {
    try {
      const response = await this.getUser(userId);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'User fetch failed',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ユーザーの保存済み検索一覧を取得（Wrapped）
   */
  async getUserSavedSearchesWrapped(userId: string): Promise<LambdaAPIResponse<SavedSearch[]>> {
    try {
      const response = await this.getUserSavedSearches(userId);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch saved searches',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 保存済み検索作成（Wrapped）
   */
  async createSavedSearchWrapped(savedSearchData: CreateSavedSearchRequest): Promise<LambdaAPIResponse<SavedSearch>> {
    try {
      const response = await this.createSavedSearch(savedSearchData);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create saved search',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 保存済み検索削除（Wrapped）
   */
  async deleteSavedSearchWrapped(id: string): Promise<LambdaAPIResponse<{ success: boolean; message: string }>> {
    try {
      const response = await this.deleteSavedSearch(id);
      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete saved search',
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
