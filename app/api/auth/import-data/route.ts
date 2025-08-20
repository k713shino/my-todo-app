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
        
        // JSONデータの構造チェック
        if (jsonData.todos && Array.isArray(jsonData.todos)) {
          todoData = jsonData.todos
        } else if (Array.isArray(jsonData)) {
          todoData = jsonData
        } else {
          throw new Error('Invalid JSON structure')
        }
      } else if (file.name.endsWith('.csv')) {
        // CSV解析（簡易版）
        const lines = fileContent.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          throw new Error('CSV file must have header and at least one data row')
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
        const requiredHeaders = ['title']
        
        if (!requiredHeaders.every(header => headers.includes(header))) {
          throw new Error('CSV must contain at least a "title" column')
        }

        todoData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
          const todo: any = {}
          
          headers.forEach((header, index) => {
            if (values[index]) {
              todo[header] = values[index]
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

    // データの正規化とバリデーション
    const normalizedTodos = todoData.map(todo => ({
      title: todo.title || 'Untitled',
      description: todo.description || '',
      priority: ['low', 'medium', 'high'].includes(todo.priority) ? todo.priority : 'medium',
      category: todo.category || 'general',
      dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : null,
      tags: typeof todo.tags === 'string' ? todo.tags : (Array.isArray(todo.tags) ? todo.tags.join(',') : '')
    })).filter(todo => todo.title.trim().length > 0)

    const actualUserId = extractUserIdFromPrefixed(session.user.id)

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

      return NextResponse.json({ 
        success: true,
        importedCount: (response.data as any)?.importedCount || normalizedTodos.length,
        message: 'Data imported successfully'
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