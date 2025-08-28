import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { prisma } from '@/lib/prisma'
import { optimizeForLambda, measureLambdaPerformance } from '@/lib/lambda-optimization'
import { Priority, Status } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface ImportTodo {
  title: string
  description?: string
  completed?: boolean
  status?: Status
  priority?: Priority
  dueDate?: string | Date | null
  category?: string | null
  tags?: string[]
}

export async function POST(request: NextRequest) {
  await optimizeForLambda()
  
  return measureLambdaPerformance('POST /api/todos/import', async () => {
    try {
      const session = await getAuthSession()
      
      if (!isAuthenticated(session)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const formData = await request.formData()
      const file = formData.get('file') as File

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      const fileText = await file.text()
      let todos: ImportTodo[] = []

      try {
        if (file.name.endsWith('.json')) {
          // JSONファイルの処理
          const jsonData = JSON.parse(fileText)
          
          // エクスポートされたデータの形式かチェック
          if (jsonData.todos && Array.isArray(jsonData.todos)) {
            todos = jsonData.todos
          } else if (Array.isArray(jsonData)) {
            todos = jsonData
          } else {
            throw new Error('Invalid JSON format')
          }
        } else if (file.name.endsWith('.csv')) {
          // CSVファイルの処理
          const lines = fileText.split('\n').filter(line => line.trim())
          if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row')
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
          
          todos = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
            const todo: ImportTodo = {
              title: values[1] || 'Imported Todo',
              description: values[2] || undefined,
              completed: values[3] === '完了',
              priority: (values[4] as Priority) || 'MEDIUM',
              dueDate: values[5] ? new Date(values[5]) : null,
              category: values[6] || undefined,
              tags: values[7] ? values[7].split(';').filter(tag => tag.trim()) : []
            }
            return todo
          })
        } else {
          return NextResponse.json({ error: 'Unsupported file format. Please use JSON or CSV.' }, { status: 400 })
        }
      } catch (parseError) {
        console.error('File parsing error:', parseError)
        return NextResponse.json({ error: 'Invalid file format or corrupted data' }, { status: 400 })
      }

      if (todos.length === 0) {
        return NextResponse.json({ error: 'No valid todos found in file' }, { status: 400 })
      }

      // バリデーションとインポート
      let importedCount = 0
      const errors: string[] = []

      for (let index = 0; index < todos.length; index++) {
        const todo = todos[index]
        try {
          if (!todo.title || todo.title.trim().length === 0) {
            errors.push(`Row ${index + 1}: Title is required`)
            continue
          }

          // 優先度の検証
          const validPriorities: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
          const priority = validPriorities.includes(todo.priority as Priority) ? 
            todo.priority as Priority : 'MEDIUM'

          // 日付の変換
          let dueDate: Date | null = null
          if (todo.dueDate) {
            const parsedDate = new Date(todo.dueDate)
            if (!isNaN(parsedDate.getTime())) {
              dueDate = parsedDate
            }
          }

          await prisma.todo.create({
            data: {
              title: todo.title.trim(),
              description: todo.description?.trim() || null,
              status: todo.status || (todo.completed ? 'DONE' : 'TODO'),
              priority,
              dueDate,
              category: todo.category?.trim() || null,
              tags: Array.isArray(todo.tags) ? todo.tags : [],
              userId: session.user.id
            }
          })

          importedCount++
        } catch (createError) {
          console.error(`Error creating todo at index ${index}:`, createError)
          errors.push(`Row ${index + 1}: Failed to create todo`)
        }
      }

      console.log(`✅ Imported ${importedCount}/${todos.length} todos for user:`, session.user.id)

      return NextResponse.json({
        success: true,
        imported: importedCount,
        total: todos.length,
        errors: errors.length > 0 ? errors : undefined
      })

    } catch (error) {
      console.error('❌ Import error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  })
}