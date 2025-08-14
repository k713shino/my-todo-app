import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { RateLimiter } from '@/lib/cache'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  await optimizeForLambda()
  
  return measureLambdaPerformance('GET /api/auth/export-data', async () => {
  try {
    console.log('🚀 Export API started')
    
    const session = await getAuthSession()
    console.log('✅ Session retrieved:', session?.user?.id ? 'Valid' : 'Invalid')
    
    if (!isAuthenticated(session)) {
      console.log('❌ Authentication failed')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // レート制限（1時間に3回まで）- 一時的に無効化してテスト
    try {
      console.log('⏳ Rate limit check started')
      const rateLimitResult = await RateLimiter.checkRateLimit(
        `export_data:${session.user.id}`, 
        3600, 
        3
      )
      console.log('✅ Rate limit check completed:', rateLimitResult)
      
      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: 'データエクスポートの試行回数が上限に達しました。1時間後に再試行してください。' },
          { status: 429 }
        )
      }
    } catch (rateLimitError) {
      console.warn('⚠️ レート制限チェックをスキップ:', rateLimitError)
      // レート制限エラーでも処理を続行
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    console.log('🔍 エクスポートAPI開始 - ユーザーID:', session.user.id, 'フォーマット:', format)

    // データベース接続を段階的にテスト
    console.log('🔍 Database connection diagnostics...')
    console.log('📊 Environment check:', {
      nodeEnv: process.env.NODE_ENV,
      vercel: process.env.VERCEL,
      databaseUrlExists: !!process.env.DATABASE_URL,
      databaseUrlLength: process.env.DATABASE_URL?.length || 0,
      isLambda: !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL)
    })

    // まずPrismaクライアントの状態確認
    try {
      console.log('⏳ Step 1: Testing basic Prisma connection...')
      
      // タイムアウト付きクエリで接続テスト
      const connectionTest = await Promise.race([
        prisma.$queryRaw`SELECT 1 as test`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
        )
      ])
      
      console.log('✅ Basic connection successful:', connectionTest)
      
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError)
      console.error('❌ Detailed error information:', {
        name: connectionError instanceof Error ? connectionError.name : 'Unknown',
        message: connectionError instanceof Error ? connectionError.message : String(connectionError),
        code: (connectionError as any)?.code,
        errno: (connectionError as any)?.errno,
        syscall: (connectionError as any)?.syscall,
        hostname: (connectionError as any)?.hostname,
        stack: connectionError instanceof Error ? connectionError.stack?.split('\n').slice(0, 5).join('\n') : undefined
      })
      
      // より具体的なエラーメッセージ
      let errorMessage = 'データベース接続エラーが発生しました'
      if (connectionError instanceof Error) {
        if (connectionError.message.includes('timeout')) {
          errorMessage = 'データベース接続がタイムアウトしました。サーバーが過負荷の可能性があります。'
        } else if (connectionError.message.includes('ECONNREFUSED')) {
          errorMessage = 'データベースサーバーが応答しません。メンテナンス中の可能性があります。'
        } else if (connectionError.message.includes('authentication')) {
          errorMessage = 'データベース認証エラーです。設定を確認してください。'
        }
      }
      
      // フォールバック: 基本的なユーザー情報のみエクスポート
      if (session?.user) {
        console.log('🔄 Providing fallback export with session data only')
        const fallbackData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            format: format,
            version: '1.0-fallback',
            note: 'データベース接続エラーのため、セッション情報のみ含まれます'
          },
          user: {
            id: session.user.id,
            name: session.user.name || 'Unknown',
            email: session.user.email || 'Unknown',
            exportedAt: new Date().toISOString()
          },
          todos: [],
          statistics: {
            totalTodos: 0,
            completedTodos: 0,
            note: 'データベース接続エラーのため、Todo情報は含まれません'
          },
          systemInfo: {
            connectionError: true,
            errorMessage: errorMessage,
            timestamp: new Date().toISOString()
          }
        }

        if (format === 'csv') {
          const csvContent = [
            'Type,Message,Timestamp',
            `Error,"${errorMessage}","${new Date().toISOString()}"`,
            `User,"${session.user.email}","${new Date().toISOString()}"`
          ].join('\n')

          return new NextResponse(csvContent, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="error-report-${new Date().toISOString().split('T')[0]}.csv"`
            }
          })
        } else {
          return new NextResponse(JSON.stringify(fallbackData, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="error-report-${new Date().toISOString().split('T')[0]}.json"`
            }
          })
        }
      }

      return NextResponse.json({ 
        error: errorMessage,
        maintenanceMode: true,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? connectionError instanceof Error ? connectionError.message : String(connectionError) : 'Connection failed'
      }, { status: 503 })
    }

    // ユーザーデータを取得（エラーハンドリング付き）
    let userData
    try {
      console.log('⏳ Database query started for user:', session.user.id)
      userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          todos: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
      console.log('✅ ユーザーデータ取得成功 - Todo数:', userData?.todos?.length || 0)
      console.log('📊 User data structure:', {
        hasUser: !!userData,
        userId: userData?.id,
        todoCount: userData?.todos?.length || 0,
        userEmail: userData?.email
      })
    } catch (dbError) {
      console.error('❌ データベース取得エラー:', dbError)
      console.error('❌ Error details:', {
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
        userId: session.user.id
      })
      return NextResponse.json({ 
        error: 'データベース接続エラーが発生しました',
        details: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 })
    }

    if (!userData) {
      console.warn('⚠️ ユーザーが見つかりません:', session.user.id)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // エクスポート用データ構造
    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        format: format,
        version: '1.0'
      },
      user: {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      },
      todos: userData.todos.map(todo => ({
        id: todo.id,
        title: todo.title,
        description: todo.description,
        completed: todo.completed,
        priority: todo.priority,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt
      })),
      statistics: {
        totalTodos: userData.todos.length,
        completedTodos: userData.todos.filter(t => t.completed).length,
        todosByPriority: {
          URGENT: userData.todos.filter(t => t.priority === 'URGENT').length,
          HIGH: userData.todos.filter(t => t.priority === 'HIGH').length,
          MEDIUM: userData.todos.filter(t => t.priority === 'MEDIUM').length,
          LOW: userData.todos.filter(t => t.priority === 'LOW').length
        }
      }
    }

    // 形式に応じてレスポンス生成
    if (format === 'csv') {
      // CSV形式
      const csvHeaders = [
        'ID', 'Title', 'Description', 'Completed', 'Priority', 'Due Date', 'Created At', 'Updated At'
      ]
      
      const csvRows = userData.todos.map(todo => {
        const escapeCsv = (str: string | null) => {
          if (!str) return ''
          return `"${str.replace(/"/g, '""')}"`
        }
        
        return [
          todo.id,
          escapeCsv(todo.title),
          escapeCsv(todo.description),
          todo.completed ? 'true' : 'false',
          todo.priority,
          todo.dueDate ? new Date(todo.dueDate).toISOString() : '',
          new Date(todo.createdAt).toISOString(),
          new Date(todo.updatedAt).toISOString()
        ]
      })

      const csvContent = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="todo-data-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    } else {
      // JSON形式
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="todo-data-${new Date().toISOString().split('T')[0]}.json"`
        }
      })
    }

  } catch (error) {
    console.error('❌ Data export error:', error)
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'データエクスポートに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
  })
}