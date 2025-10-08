// データベースアダプター - Prisma または Lambda DB を環境に応じて使い分け
import { lambdaDB } from './lambda-db'
import { prisma } from './prisma'

const USE_LAMBDA_DB = process.env.USE_LAMBDA_DB === 'true' || 
                      process.env.VERCEL === '1' || 
                      process.env.NODE_ENV === 'production'

console.log('🔧 Database adapter mode:', USE_LAMBDA_DB ? 'Lambda DB' : 'Direct Prisma')

export const dbAdapter = {
  // データベース接続テスト
  async testConnection() {
    if (USE_LAMBDA_DB) {
      const result = await lambdaDB.testConnection()
      return { success: result.success, details: result }
    } else {
      try {
        await prisma.$queryRaw`SELECT 1`
        return { success: true, details: 'Direct Prisma connection successful' }
      } catch (error) {
        return { 
          success: false, 
          details: { error: error instanceof Error ? error.message : String(error) }
        }
      }
    }
  },

  // ユーザー操作
  async getUser(userId: string) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.getUser(userId)
    } else {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: { _count: { select: { todos: true } } }
        })
        return { success: true, data: user, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async getUserByEmail(email: string) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.getUserByEmail(email)
    } else {
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          include: { _count: { select: { todos: true } } }
        })
        return { success: true, data: user, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async createUser(userData: Record<string, unknown>) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.createUser(userData as { email: string; password: string; name?: string })
    } else {
      try {
        const user = await prisma.user.create({
          data: userData as { email: string; password: string; name?: string | null },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true
          }
        })
        return { success: true, data: user, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async updateUser(userId: string, userData: Record<string, unknown>) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.updateUser(userId, userData)
    } else {
      try {
        const user = await prisma.user.update({
          where: { id: userId },
          data: userData,
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true
          }
        })
        return { success: true, data: user, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async deleteUser(userId: string) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.deleteUser(userId)
    } else {
      try {
        await prisma.user.delete({
          where: { id: userId }
        })
        return { success: true, message: 'User deleted successfully', error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async getUserCount() {
    if (USE_LAMBDA_DB) {
      // Lambda経由でユーザー数を取得（統計APIを使用）
      const result = await lambdaDB.getDiagnostics()
      return result
    } else {
      try {
        const count = await prisma.user.count()
        return { success: true, data: count, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  // Todo操作
  async getTodos(userId: string, filters?: Record<string, unknown>) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.getTodos(userId, filters)
    } else {
      try {
        const todos = await prisma.todo.findMany({
          where: {
            userId,
            ...(filters?.completed !== undefined ? { completed: filters.completed } : {}),
            ...(filters?.priority ? { priority: filters.priority } : {}),
            ...(filters?.search ? {
              OR: [
                { title: { contains: filters.search as string, mode: 'insensitive' } },
                { description: { contains: filters.search as string, mode: 'insensitive' } }
              ]
            } : {})
          },
          orderBy: { createdAt: 'desc' }
        })
        return { success: true, data: todos, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async createTodo(userId: string, todoData: Record<string, unknown>) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.createTodo(userId, todoData)
    } else {
      try {
        const todo = await prisma.todo.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { ...todoData, userId } as any
        })
        return { success: true, data: todo, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async updateTodo(userId: string, todoId: string, todoData: Record<string, unknown>) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.updateTodo(userId, todoId, todoData)
    } else {
      try {
        const todo = await prisma.todo.update({
          where: { id: todoId, userId },
          data: todoData
        })
        return { success: true, data: todo, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  async deleteTodo(userId: string, todoId: string) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.deleteTodo(userId, todoId)
    } else {
      try {
        await prisma.todo.delete({
          where: { id: todoId, userId }
        })
        return { success: true, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  // 認証関連
  async getAuthMethods(userId: string) {
    if (USE_LAMBDA_DB) {
      return lambdaDB.getAuthMethods(userId)
    } else {
      try {
        const accounts = await prisma.account.findMany({
          where: { userId },
          select: { provider: true, providerAccountId: true }
        })
        return { success: true, data: { authMethods: accounts }, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  },

  // データエクスポート
  async exportUserData(userId: string, format: 'json' | 'csv' = 'json') {
    if (USE_LAMBDA_DB) {
      return lambdaDB.exportUserData(userId, format)
    } else {
      try {
        const userData = await prisma.user.findUnique({
          where: { id: userId },
          include: { todos: { orderBy: { createdAt: 'desc' } } }
        })
        
        if (!userData) {
          return { success: false, error: 'User not found' }
        }

        const exportData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            format,
            version: '1.0'
          },
          user: {
            id: userData.id,
            name: userData.name,
            email: userData.email,
            createdAt: userData.createdAt,
            updatedAt: userData.updatedAt
          },
          todos: userData.todos,
          statistics: {
            totalTodos: userData.todos.length,
            completedTodos: userData.todos.filter(t => t.status === 'DONE').length
          }
        }

        return { success: true, data: exportData, error: undefined }
      } catch (error) {
        return { 
          success: false, 
          data: null,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }
}

export default dbAdapter