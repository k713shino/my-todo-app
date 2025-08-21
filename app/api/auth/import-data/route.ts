import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Data import API called')
    
    const session = await getAuthSession()
    console.log('Session:', session ? { userId: session.user?.id, email: session.user?.email } : 'null')
    
    if (!isAuthenticated(session)) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    console.log('File:', file ? { name: file.name, size: file.size, type: file.type } : 'null')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // ファイル形式チェック
    const allowedTypes = ['application/json', 'text/csv', 'text/plain']
    const isValidType = allowedTypes.includes(file.type) || 
                       file.name.endsWith('.json') || 
                       file.name.endsWith('.csv')

    if (!isValidType) {
      return NextResponse.json({ 
        error: 'Invalid file format. Only JSON and CSV files are allowed.' 
      }, { status: 400 })
    }

    // ファイルサイズチェック (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum size is 10MB.' 
      }, { status: 400 })
    }

    // ファイル内容を読み取り
    const fileContent = await file.text()
    let todoData: any[] = []

    try {
      if (file.name.endsWith('.json')) {
        const jsonData = JSON.parse(fileContent)
        
        // GDPR準拠エクスポート形式の構造チェック
        if (jsonData.todos && Array.isArray(jsonData.todos)) {
          // GDPR準拠エクスポートファイル（推奨形式）
          todoData = jsonData.todos
          console.log('📋 GDPR準拠エクスポート形式を検出:', {
            exportInfo: jsonData.exportInfo?.version || 'unknown',
            userInfo: jsonData.user?.id || 'unknown',
            todoCount: jsonData.todos.length,
            hasStatistics: !!jsonData.statistics
          })
        } else if (Array.isArray(jsonData)) {
          // 従来の配列形式
          todoData = jsonData
          console.log('📋 従来の配列形式を検出:', { todoCount: jsonData.length })
        } else {
          throw new Error('Invalid JSON structure. Expected format: {todos: [...]} or [...]')
        }
      } else if (file.name.endsWith('.csv')) {
        // GDPR準拠CSV解析（エクスポート形式対応）
        const lines = fileContent.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          throw new Error('CSV file must have header and at least one data row')
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        console.log('📋 CSVヘッダーを検出:', headers)
        
        // GDPR準拠エクスポート形式のヘッダーチェック
        const expectedHeaders = ['ID', 'Title', 'Description', 'Completed', 'Priority', 'Due Date', 'Created At', 'Updated At']
        const hasGDPRFormat = expectedHeaders.some(header => headers.includes(header))
        
        if (hasGDPRFormat) {
          console.log('📋 GDPR準拠CSVエクスポート形式を検出')
        }
        
        // 最低限必要なヘッダーチェック
        const titleHeader = headers.find(h => 
          h.toLowerCase().includes('title') || h === 'Title'
        )
        
        if (!titleHeader) {
          throw new Error('CSV must contain a "Title" or "title" column')
        }

        todoData = lines.slice(1).map(line => {
          // CSVの値を簡易解析（パフォーマンス最適化）
          const values = line.split(',').map(value => {
            // ダブルクォートの処理
            return value.trim().replace(/^"|"$/g, '').replace(/""/g, '"')
          })
          
          const todo: any = {}
          
          headers.forEach((header, index) => {
            const value = values[index]?.trim()
            if (value) {
              // ヘッダー名を標準形式にマッピング
              switch (header) {
                case 'ID':
                  todo.originalId = value
                  break
                case 'Title':
                  todo.title = value
                  break
                case 'Description':
                  todo.description = value
                  break
                case 'Completed':
                  todo.completed = value.toLowerCase() === 'true'
                  break
                case 'Priority':
                  todo.priority = value
                  console.log('🔍 CSV Priority処理:', { header, value, result: value })
                  break
                case 'Due Date':
                  todo.dueDate = value
                  break
                case 'Created At':
                  todo.createdAt = value
                  break
                case 'Updated At':
                  todo.updatedAt = value
                  break
                default:
                  // 小文字のヘッダーもサポート
                  todo[header.toLowerCase()] = value
                  break
              }
            }
          })
          
          return todo
        }).filter(todo => todo.title) // タイトルがあるもののみ
      }
    } catch (parseError) {
      console.error('File parsing error:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse file. Please check the file format.' 
      }, { status: 400 })
    }

    if (todoData.length === 0) {
      return NextResponse.json({ 
        error: 'No valid todo items found in the file.' 
      }, { status: 400 })
    }

    // GDPR準拠データの正規化とバリデーション
    const normalizedTodos = todoData.map(todo => {
      // 基本的なデータ正規化
      // 優先度を大文字に変換（UIコンポーネントの要求に合わせる）
      const priorityValue = todo.priority && ['low', 'medium', 'high'].includes(todo.priority.toLowerCase()) 
        ? todo.priority.toUpperCase() 
        : 'MEDIUM'
      
      console.log('🔍 優先度正規化:', { 
        originalPriority: todo.priority, 
        normalizedPriority: priorityValue,
        title: todo.title 
      })
      
      const normalized: any = {
        title: todo.title || 'Untitled',
        description: todo.description || '',
        priority: priorityValue,
        category: todo.category || 'general',
        dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : null,
        tags: typeof todo.tags === 'string' ? todo.tags : (Array.isArray(todo.tags) ? todo.tags.join(',') : '')
      }
      
      // GDPR準拠エクスポートデータの追加フィールドを保持
      if (todo.completed !== undefined) {
        normalized.completed = Boolean(todo.completed)
      }
      
      // 元のIDが存在する場合は保持（重複チェック用）
      if (todo.originalId || todo.id) {
        normalized.originalId = todo.originalId || todo.id
      }
      
      // タイムスタンプ情報の保持（参考情報として）
      if (todo.createdAt) {
        normalized.originalCreatedAt = todo.createdAt
      }
      if (todo.updatedAt) {
        normalized.originalUpdatedAt = todo.updatedAt
      }
      
      return normalized
    }).filter(todo => todo.title.trim().length > 0)
    
    console.log('📊 正規化されたデータサンプル:', {
      totalCount: normalizedTodos.length,
      hasCompleted: normalizedTodos.some(t => t.completed !== undefined),
      hasOriginalIds: normalizedTodos.some(t => t.originalId),
      hasTimestamps: normalizedTodos.some(t => t.originalCreatedAt),
      sampleData: normalizedTodos.slice(0, 2).map(t => ({
        title: t.title,
        completed: t.completed,
        priority: t.priority,
        originalId: t.originalId,
        hasTimestamp: !!t.originalCreatedAt
      }))
    })
    
    console.log('🔍 優先度の詳細チェック:', {
      priorities: normalizedTodos.map(t => ({ title: t.title, priority: t.priority, originalPriority: todoData.find(orig => orig.title === t.title)?.priority }))
    })

    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    
    console.log('📊 Import request details:', {
      userId: actualUserId,
      userEmail: session.user.email,
      userName: session.user.name,
      todoCount: normalizedTodos.length,
      sampleTodos: normalizedTodos.slice(0, 2).map(t => ({ title: t.title, priority: t.priority }))
    })

    try {
      // Lambda API経由でデータをインポート
      const response = await lambdaAPI.post('/import-todos', {
        userId: actualUserId,
        userEmail: session.user.email,
        userName: session.user.name,
        todos: normalizedTodos
      })

      console.log('Lambda import response:', response)

      if (!response.success) {
        console.error('Lambda import failed:', response.error)
        
        // エラーメッセージから適切なステータスコードを判定
        let statusCode = 400
        if (response.error?.includes('Unauthorized')) {
          statusCode = 401
        } else if (response.error?.includes('not found')) {
          statusCode = 404
        } else if (response.error?.includes('required')) {
          statusCode = 400
        }
        
        return NextResponse.json({ 
          error: response.error || 'Import failed' 
        }, { status: statusCode })
      }

      // Lambdaからの詳細なレスポンスを解析
      const lambdaData = response.data as any
      const importedCount = lambdaData?.importedCount || 0
      const skippedCount = lambdaData?.skippedCount || 0
      const totalCount = lambdaData?.totalCount || normalizedTodos.length

      console.log('📈 Import results:', {
        imported: importedCount,
        skipped: skippedCount,
        total: totalCount,
        originalFileCount: todoData.length,
        normalizedCount: normalizedTodos.length
      })

      return NextResponse.json({ 
        success: true,
        importedCount,
        skippedCount,
        totalCount,
        message: importedCount > 0 
          ? `Successfully imported ${importedCount} todos${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`
          : `All ${totalCount} todos were skipped due to duplicates`
      })

    } catch (error) {
      console.error('Lambda API error:', error)
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}