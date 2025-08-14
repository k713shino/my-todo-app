// Lambda経由でのデータベース操作ライブラリ
import { Todo } from '@/types/todo'

const LAMBDA_API_URL = process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL

interface LambdaResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class LambdaDB {
  private baseUrl: string

  constructor() {
    this.baseUrl = LAMBDA_API_URL || 'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod'
    console.log('🔗 Lambda DB initialized with URL:', this.baseUrl)
  }

  // HTTP リクエストの共通処理
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<LambdaResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    
    try {
      console.log(`🚀 Lambda API request: ${options.method || 'GET'} ${url}`)
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        // Vercel環境でのタイムアウト設定
        ...(typeof window === 'undefined' && { 
          signal: AbortSignal.timeout(25000) // 25秒タイムアウト
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Lambda API error: ${response.status} ${response.statusText}`, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('✅ Lambda API success:', { endpoint, status: response.status })
      
      return data
    } catch (error) {
      console.error('❌ Lambda API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // データベース接続テスト
  async testConnection(): Promise<LambdaResponse> {
    return this.request('/database/test', { method: 'GET' })
  }

  // ユーザー操作
  async getUser(userId: string): Promise<LambdaResponse> {
    return this.request(`/users/${userId}`, { method: 'GET' })
  }

  async getUserByEmail(email: string): Promise<LambdaResponse> {
    return this.request(`/users/email/${encodeURIComponent(email)}`, { method: 'GET' })
  }

  async createUser(userData: any): Promise<LambdaResponse> {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    })
  }

  async updateUser(userId: string, userData: any): Promise<LambdaResponse> {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    })
  }

  async deleteUser(userId: string): Promise<LambdaResponse> {
    return this.request(`/users/${userId}`, { method: 'DELETE' })
  }

  // Todo操作
  async getTodos(userId: string, filters?: any): Promise<LambdaResponse<Todo[]>> {
    const queryParams = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    const endpoint = `/users/${userId}/todos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.request(endpoint, { method: 'GET' })
  }

  async getTodo(userId: string, todoId: string): Promise<LambdaResponse<Todo>> {
    return this.request(`/users/${userId}/todos/${todoId}`, { method: 'GET' })
  }

  async createTodo(userId: string, todoData: Partial<Todo>): Promise<LambdaResponse<Todo>> {
    return this.request(`/users/${userId}/todos`, {
      method: 'POST',
      body: JSON.stringify(todoData)
    })
  }

  async updateTodo(userId: string, todoId: string, todoData: Partial<Todo>): Promise<LambdaResponse<Todo>> {
    return this.request(`/users/${userId}/todos/${todoId}`, {
      method: 'PUT',
      body: JSON.stringify(todoData)
    })
  }

  async deleteTodo(userId: string, todoId: string): Promise<LambdaResponse> {
    return this.request(`/users/${userId}/todos/${todoId}`, { method: 'DELETE' })
  }

  // 認証関連
  async getAuthMethods(userId: string): Promise<LambdaResponse> {
    return this.request(`/users/${userId}/auth-methods`, { method: 'GET' })
  }

  // データエクスポート
  async exportUserData(userId: string, format: 'json' | 'csv' = 'json'): Promise<LambdaResponse> {
    return this.request(`/users/${userId}/export?format=${format}`, { method: 'GET' })
  }

  // 統計情報
  async getUserStats(userId: string): Promise<LambdaResponse> {
    return this.request(`/users/${userId}/stats`, { method: 'GET' })
  }

  // バッチ操作
  async batchUpdateTodos(userId: string, updates: Array<{id: string, data: Partial<Todo>}>): Promise<LambdaResponse> {
    return this.request(`/users/${userId}/todos/batch`, {
      method: 'PATCH',
      body: JSON.stringify({ updates })
    })
  }

  // ヘルスチェック
  async healthCheck(): Promise<LambdaResponse> {
    return this.request('/health', { method: 'GET' })
  }

  // 診断情報
  async getDiagnostics(): Promise<LambdaResponse> {
    return this.request('/diagnostics', { method: 'GET' })
  }
}

// シングルトンインスタンス
const lambdaDB = new LambdaDB()

export { lambdaDB, LambdaDB }
export type { LambdaResponse }
export default lambdaDB