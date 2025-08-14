// Lambda経由でのデータベース操作ライブラリ
import { Todo } from '@/types/todo'

const LAMBDA_API_URL = process.env.LAMBDA_API_URL || process.env.NEXT_PUBLIC_LAMBDA_API_URL

interface LambdaResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  httpStatus?: number
  details?: any
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
        
        // 404エラーの場合は特別な処理
        if (response.status === 404) {
          return {
            success: false,
            error: `Endpoint not found: ${endpoint}`,
            httpStatus: response.status,
            details: errorText
          }
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          httpStatus: response.status,
          details: errorText
        }
      }

      const data = await response.json()
      console.log('✅ Lambda API success:', { endpoint, status: response.status, data })
      
      // Lambda関数からの応答を適切な形式に変換
      return {
        success: true,
        data: data,
        httpStatus: response.status
      }
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
    // 実際に動作するルートエンドポイントを使用
    try {
      const result = await this.request('/', { method: 'GET' })
      if (result.success) {
        console.log(`✅ Found working test endpoint: /`)
        return result
      }
    } catch (error) {
      console.log(`❌ Failed root endpoint:`, error instanceof Error ? error.message : String(error))
    }
    
    return {
      success: false,
      error: 'Root endpoint connection failed'
    }
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
    
    // UserID をクエリパラメータとして追加
    queryParams.append('userId', userId)
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value))
        }
      })
    }
    
    const endpoint = `/todos${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const result = await this.request(endpoint, { method: 'GET' })
    
    // Lambda関数がユーザーフィルタリングをサポートしていない場合、クライアント側でフィルタリング
    if (result.success && Array.isArray(result.data)) {
      const filteredTodos = result.data.filter((todo: any) => todo.userId === userId)
      console.log(`🔍 Filtered todos for user ${userId}: ${filteredTodos.length}/${result.data.length}`)
      
      return {
        ...result,
        data: filteredTodos
      } as LambdaResponse<Todo[]>
    }
    
    return result as LambdaResponse<Todo[]>
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

  // データエクスポート（Lambda側にエンドポイントがないため、既存のエンドポイントを組み合わせて実装）
  async exportUserData(userId: string, format: 'json' | 'csv' = 'json'): Promise<LambdaResponse> {
    try {
      console.log(`🔄 Building export data for user ${userId} in ${format} format`)
      
      // 1. ユーザー専用のTodosデータを取得（フィルタリング済み）
      const todosResult = await this.getTodos(userId)
      if (!todosResult.success) {
        return { 
          success: false, 
          error: `Failed to fetch user todos: ${todosResult.error}` 
        }
      }
      
      const todos = todosResult.data || []
      
      // 2. ユーザーの統計情報を計算
      const totalTodos = todos.length
      const completedTodos = todos.filter((todo: any) => todo.completed).length
      const pendingTodos = totalTodos - completedTodos
      
      // 3. カテゴリ・優先度別の統計
      const categoryStats = todos.reduce((acc: any, todo: any) => {
        const category = todo.category || 'uncategorized'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {})
      
      const priorityStats = todos.reduce((acc: any, todo: any) => {
        acc[todo.priority] = (acc[todo.priority] || 0) + 1
        return acc
      }, {})
      
      // 4. エクスポート用のデータ構造を構築
      const exportData = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          format,
          version: '1.0-lambda',
          userId,
          note: 'User-specific data export via Lambda'
        },
        user: {
          id: userId,
          name: `User ${userId.slice(-8)}`, // UserIDの末尾8文字を使用
          email: `user.${userId.slice(-8)}@app.com`,
          dataSource: 'Lambda API'
        },
        todos: todos,
        statistics: {
          totalTodos,
          completedTodos,
          pendingTodos,
          completionRate: totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0,
          categoryBreakdown: categoryStats,
          priorityBreakdown: priorityStats
        }
      }
      
      console.log(`✅ Export data built successfully: ${totalTodos} todos for user ${userId}`)
      
      return {
        success: true,
        data: exportData
      }
      
    } catch (error) {
      console.error('❌ Export data building failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      }
    }
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
    // 実際に動作するルートエンドポイントを使用
    try {
      const result = await this.request('/', { method: 'GET' })
      if (result.success) {
        console.log(`✅ Found working health endpoint: /`)
        return result
      }
    } catch (error) {
      console.log(`❌ Health check failed for /:`, error instanceof Error ? error.message : String(error))
    }
    
    return {
      success: false,
      error: 'Root endpoint health check failed'
    }
  }

  // 診断情報
  async getDiagnostics(): Promise<LambdaResponse> {
    // 実際に動作するルートエンドポイントを使用
    try {
      const result = await this.request('/', { method: 'GET' })
      if (result.success) {
        console.log(`✅ Found working diagnostics endpoint: /`)
        return result
      }
    } catch (error) {
      console.log(`❌ Diagnostics failed for /:`, error instanceof Error ? error.message : String(error))
    }
    
    return {
      success: false,
      error: 'Root endpoint diagnostics failed'
    }
  }
}

// シングルトンインスタンス
const lambdaDB = new LambdaDB()

export { lambdaDB, LambdaDB }
export type { LambdaResponse }
export default lambdaDB