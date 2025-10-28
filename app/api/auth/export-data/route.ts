import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { RateLimiter } from '@/lib/cache'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'
import dbAdapter from '@/lib/db-adapter'

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
    const format = searchParams.get('format') || searchParams.get('_format') || 'json'

    console.log('🔍 エクスポートAPI開始 - ユーザーID:', session.user.id, 'フォーマット:', format, 'クエリ:', Object.fromEntries(searchParams.entries()))

    // データベース接続テスト（Lambda経由）
    console.log('🔍 Testing database connection via adapter...')
    const connectionTest = await dbAdapter.testConnection()
    
    if (!connectionTest.success) {
      console.error('❌ Database connection failed:', connectionTest.details)
      
      // フォールバック: セッション情報のみエクスポート
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
            errorMessage: 'Lambda経由でのデータベース接続に失敗しました',
            timestamp: new Date().toISOString()
          }
        }

        if (format === 'csv') {
          const csvContent = [
            'Type,Message,Timestamp',
            `Error,"Lambda DB connection failed","${new Date().toISOString()}"`,
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
        error: 'Lambda経由でのデータベース接続に失敗しました',
        maintenanceMode: true,
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }
    
    console.log('✅ Database connection successful via adapter')

    // ユーザーデータを取得（Lambda経由）
    console.log('⏳ Fetching user data via Lambda for user:', session.user.id)
    const exportResult = await dbAdapter.exportUserData(session.user.id, format as 'json' | 'csv')
    
    if (!exportResult.success) {
      console.error('❌ データエクスポートエラー:', exportResult.error)
      return NextResponse.json({ 
        error: 'データエクスポートに失敗しました',
        details: exportResult.error
      }, { status: 500 })
    }

    const exportData = exportResult.data as {
      user?: {
        id?: string;
        name?: string | null;
        email?: string | null;
        dataSource?: string;
      };
      todos?: Record<string, unknown>[]
    }
    if (!exportData) {
      console.warn('⚠️ エクスポートデータが見つかりません:', session.user.id)
      return NextResponse.json({ error: 'Export data not found' }, { status: 404 })
    }

    // セッション情報でユーザーデータを上書き（より正確な情報を使用）
    if (exportData.user && session.user) {
      exportData.user = {
        ...exportData.user,
        id: session.user.id,
        name: session.user.name || exportData.user.name,
        email: session.user.email || exportData.user.email,
        dataSource: 'Lambda API + Session'
      }
    }

    console.log('✅ Lambda経由でのデータ取得成功 - Todo数:', exportData.todos?.length || 0, 'ユーザー:', session.user.email)

    // 形式に応じてレスポンス生成
    if (format === 'csv') {
      // CSV形式（現行仕様: 4ステータス/カテゴリ/タグ/親子関係対応、後方互換でCompletedも含む）
      const csvHeaders = [
        'ID', 'Title', 'Description', 'Status', 'Completed', 'Priority', 'Category', 'Tags', 'Due Date', 'Created At', 'Updated At'
      ]
      
      const csvRows = (exportData.todos || []).map((todo: Record<string, unknown>): string[] => {
        const escapeCsv = (str: string | null | undefined) => {
          if (!str) return ''
          return `"${String(str).replace(/"/g, '""')}"`
        }

        return [
          String(todo.id),
          escapeCsv(String(todo.title || '')),
          escapeCsv(String(todo.description || '')),
          String(todo.status || (todo.completed ? 'DONE' : 'TODO')),
          (todo.completed ? 'true' : 'false'),
          String(todo.priority),
          escapeCsv(String(todo.category || '')),
          escapeCsv(Array.isArray(todo.tags) ? todo.tags.join(',') : String(todo.tags || '')),
          todo.dueDate ? new Date(String(todo.dueDate)).toISOString() : '',
          new Date(String(todo.createdAt)).toISOString(),
          new Date(String(todo.updatedAt)).toISOString()
        ]
      })

      const csvContent = [csvHeaders.join(','), ...csvRows.map((row) => row.join(','))].join('\n')

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
