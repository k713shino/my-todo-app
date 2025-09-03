import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { CacheManager } from '@/lib/cache'

// CSVテキストを安全に解析（引用符・改行・二重引用符エスケープ対応）
function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  if (!text) return { headers: [], rows: [] }
  // UTF-8 BOM除去
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1]
        if (next === '"') { field += '"'; i++ } else { inQuotes = false }
      } else { field += ch }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* CRLF無視 */ }
      else { field += ch }
    }
  }
  row.push(field); rows.push(row)
  const nonEmpty = rows.filter(r => r.some(c => c.trim().length > 0))
  const headers = (nonEmpty[0] || []).map(h => h.trim())
  const dataRows = nonEmpty.slice(1)
  return { headers, rows: dataRows }
}

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
      // 既存ユーザーのTodoを取得（重複検知のため）
      const existingTodos: any[] = await lambdaAPI.getUserTodos(actualUserId)

      // 文字列正規化（NFKC + 小文字 + 句読点/記号/余分な空白除去）
      const normalizeStr = (s: string) => (s || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[\p{P}\p{S}]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      // トークン化
      const tokenize = (s: string) => new Set(normalizeStr(s).split(' ').filter(Boolean))
      // Jaccard類似度
      const jaccard = (a: Set<string>, b: Set<string>) => {
        if (a.size === 0 && b.size === 0) return 1
        let inter = 0
        for (const t of a) if (b.has(t)) inter++
        const uni = a.size + b.size - inter
        return uni === 0 ? 1 : inter / uni
      }
      const eqDay = (d1?: string | null, d2?: string | null) => {
        if (!d1 && !d2) return true
        if (!d1 || !d2) return false
        const a = new Date(d1)
        const b = new Date(d2)
        if (isNaN(a.getTime()) || isNaN(b.getTime())) return d1 === d2
        const da = `${a.getFullYear()}-${a.getMonth()+1}-${a.getDate()}`
        const db = `${b.getFullYear()}-${b.getMonth()+1}-${b.getDate()}`
        return da === db
      }
      const eqNullable = (x?: string | null, y?: string | null) => (x || '') === (y || '')

      const existingIndexByTitle = new Map<string, any[]>()
      for (const e of existingTodos) {
        const key = normalizeStr(e.title)
        const arr = existingIndexByTitle.get(key) || []
        arr.push(e)
        existingIndexByTitle.set(key, arr)
      }

      const isDuplicateOfExisting = (t: any): any | null => {
        const key = normalizeStr(t.title)
        const candidates = [
          ...(existingIndexByTitle.get(key) || []),
          // 類似タイトル候補（簡易探索）: 同じ先頭語を含むもの
          ...Array.from(existingIndexByTitle.entries())
            .filter(([k]) => k !== key && (k.includes(key) || key.includes(k)))
            .flatMap(([, v]) => v)
        ]
        const tTokens = tokenize(t.title)
        let best: any | null = null
        let bestScore = 0
        for (const c of candidates) {
          const score = jaccard(tTokens, tokenize(c.title))
          // 厳密一致 or 高類似度 + 重要フィールド一致で重複判定
          const exact = normalizeStr(c.title) === key
          const strongSimilar = score >= 0.9
          const dateOk = eqDay(t.dueDate ?? null, c.dueDate ?? null)
          const catOk = eqNullable(t.category ?? null, c.category ?? null)
          if ((exact || strongSimilar) && dateOk && catOk) {
            if (score > bestScore) { best = c; bestScore = score }
          }
        }
        return best
      }

      // バッチ内重複（originalId優先、なければキー合成）をスキップ
      const seen = new Set<string>()
      const batchKey = (t: any) => {
        if (t.originalId) return `oid:${String(t.originalId)}`
        return `k:${normalizeStr(t.title)}|d:${t.dueDate ? new Date(t.dueDate).toDateString() : 'none'}|c:${(t.category||'')}`
      }
      const uniqueTodos = normalizedTodos.filter(t => {
        const key = batchKey(t)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
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
        // CSV解析（引用符・改行対応）
        const { headers, rows } = parseCSVText(fileContent)
        if (headers.length === 0 || rows.length === 0) {
          throw new Error('CSV file must have header and at least one data row')
        }
        console.log('📋 CSVヘッダーを検出:', headers)
        
        // GDPR準拠エクスポート形式のヘッダーチェック
        const expectedHeaders = ['ID', 'Title', 'Description', 'Status', 'Completed', 'Priority', 'Category', 'Tags', 'Parent ID', 'Due Date', 'Created At', 'Updated At']
        const hasGDPRFormat = expectedHeaders.some(header => headers.includes(header))
        
        if (hasGDPRFormat) {
          console.log('📋 GDPR準拠CSVエクスポート形式を検出')
        }
        
        // 最低限必要なヘッダーチェック
        const titleHeader = headers.find(h => h.toLowerCase() === 'title' || h === 'Title')
        
        if (!titleHeader) {
          throw new Error('CSV must contain a "Title" column')
        }

        todoData = rows.map(values => {
          
          const todo: any = {}
          
          headers.forEach((header, index) => {
            const value = (values[index] ?? '').trim()
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
                case 'Status':
                  todo.status = value
                  break
                case 'Completed':
                  todo.completed = value.toLowerCase() === 'true'
                  break
                case 'Priority':
                  todo.priority = value
                  console.log('🔍 CSV Priority処理:', { header, value, result: value })
                  break
                case 'Category':
                  todo.category = value
                  break
                case 'Tags':
                  todo.tags = value
                  break
                case 'Parent ID':
                case 'ParentId':
                case 'ParentID':
                  todo.parentOriginalId = value
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
      const priorityValue = (() => {
        const pRaw = (todo.priority || '').toString()
        const p = pRaw.toUpperCase()
        if (['LOW','MEDIUM','HIGH','URGENT'].includes(p)) return p
        const lower = pRaw.toLowerCase()
        if (['low','medium','high','urgent'].includes(lower)) return lower.toUpperCase()
        return 'MEDIUM'
      })()
      
      console.log('🔍 優先度正規化:', { 
        originalPriority: todo.priority, 
        normalizedPriority: priorityValue,
        title: todo.title 
      })
      
      const statusValue = (() => {
        const sRaw = (todo.status || '').toString()
        const s = sRaw.toUpperCase()
        if (['TODO','IN_PROGRESS','REVIEW','DONE'].includes(s)) return s
        if (todo.completed === true) return 'DONE'
        if (todo.completed === false) return 'TODO'
        return 'TODO'
      })()

      const normalized: any = {
        title: todo.title || 'Untitled',
        description: todo.description || '',
        status: statusValue,
        priority: priorityValue,
        category: todo.category || null,
        dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : null,
        tags: Array.isArray(todo.tags)
          ? todo.tags
          : (typeof todo.tags === 'string' && todo.tags.length > 0
              ? todo.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
              : [])
      }
      
      // GDPR準拠エクスポートデータの追加フィールドを保持
      if (todo.completed !== undefined) {
        normalized.completed = Boolean(todo.completed)
      }
      
      // 元のIDが存在する場合は保持（重複チェック用）
      if (todo.originalId || todo.id) {
        normalized.originalId = todo.originalId || todo.id
      }
      if (todo.parentOriginalId) {
        normalized.parentOriginalId = todo.parentOriginalId
      }
      // JSONエクスポート由来の親参照（parentId）も受け入れる
      if (!normalized.parentOriginalId && (todo.parentId || (todo as any).parent_id)) {
        normalized.parentOriginalId = todo.parentId || (todo as any).parent_id
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
      // 並列度（同時実行数）を環境変数で制御。デフォルト4。
      const CONCURRENCY = Math.max(1, parseInt(process.env.IMPORT_CONCURRENCY || '4', 10) || 4)

      // シンプルな並列ワーカー実装
      const runWithConcurrency = async <T>(
        items: T[],
        worker: (item: T, index: number) => Promise<void>,
        limit = CONCURRENCY
      ) => {
        let cursor = 0
        const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
          while (true) {
            const myIndex = cursor++
            if (myIndex >= items.length) break
            await worker(items[myIndex], myIndex)
          }
        })
        await Promise.all(workers)
      }

      // 2パス方式で親→子の順に作成（親子関係を確実に復元）
      const parents = uniqueTodos.filter(t => !t.parentOriginalId)
      const children = uniqueTodos.filter(t => t.parentOriginalId)
      const idMap = new Map<string, string>() // originalId -> newId
      let importedCount = 0
      let skippedCount = 0

      const createOne = async (payload: any) => {
        const res = await lambdaAPI.post('/todos', {
          title: payload.title,
          description: payload.description || undefined,
          userId: actualUserId,
          userEmail: session.user.email || undefined,
          userName: session.user.name || undefined,
          priority: payload.priority || 'MEDIUM',
          status: payload.status || 'TODO',
          dueDate: payload.dueDate || undefined,
          category: payload.category || undefined,
          tags: Array.isArray(payload.tags) ? payload.tags : undefined,
          parentId: payload.parentId || undefined,
        })
        if (res.success && res.data) {
          importedCount++
          return res.data
        } else {
          skippedCount++
          return null
        }
      }

      // 親を並列作成（重複ならスキップし、既存IDへマップ）
      await runWithConcurrency(parents, async (t) => {
        const dup = isDuplicateOfExisting(t)
        if (dup) {
          skippedCount++
          if (t.originalId) {
            idMap.set(String(t.originalId), String(dup.id))
          }
          return
        }
        const created = await createOne(t)
        if (created && t.originalId) idMap.set(String(t.originalId), String((created as any).id))
      })

      // 子を並列作成（親ID解決後、重複ならスキップ）
      await runWithConcurrency(children, async (t) => {
        const parentOrig = String(t.parentOriginalId)
        const parentNewId = idMap.get(parentOrig)
        const payload = { ...t, parentId: parentNewId }
        const dup = isDuplicateOfExisting(payload)
        if (dup) {
          skippedCount++
          if (t.originalId) idMap.set(String(t.originalId), String(dup.id))
          return
        }
        const created = await createOne(payload)
        if (created && t.originalId) idMap.set(String(t.originalId), String((created as any).id))
      })

      const totalCount = uniqueTodos.length
      console.log('📈 Import results (2-pass, parallelized):', { importedCount, skippedCount, totalCount, concurrency: CONCURRENCY, parents: parents.length, children: children.length })

      // キャッシュ無効化
      try { await CacheManager.invalidateUserTodos(session.user.id) } catch {}

      return NextResponse.json({
        success: true,
        importedCount,
        skippedCount,
        totalCount,
        message: importedCount > 0
          ? `Successfully imported ${importedCount} todos${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`
          : `All ${totalCount} todos were skipped due to errors or duplicates`
      })

    } catch (error) {
      console.error('Import processing error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

  } catch (error) {
    console.error('Import API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
