import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { redis } from '@/lib/redis'
import { parseCSVText, normalizeTodos } from '@/lib/import-utils'

const TTL_SEC = parseInt(process.env.IMPORT_TTL_SEC || '1800', 10) // 30分

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const content = await file.text()
    let rows: Record<string, unknown>[] = []
    if (file.name.endsWith('.json') || (file.type && file.type.includes('json'))) {
      const json = JSON.parse(content)
      rows = Array.isArray(json) ? json : (Array.isArray(json.todos) ? json.todos : [])
    } else {
      const { headers, rows: csvRows } = parseCSVText(content)
      if (headers.length === 0) return NextResponse.json({ error: 'Invalid CSV' }, { status: 400 })
      rows = csvRows.map(values => {
        const t: Record<string, unknown> = {}
        headers.forEach((h, idx) => { t[h] = (values[idx] ?? '').trim() })
        // 標準キーへ寄せる（最低限）
        if (t.Title && !t.title) t.title = t.Title
        if (t.Description && !t.description) t.description = t.Description
        if (t.Status && !t.status) t.status = t.Status
        if (t.Priority && !t.priority) t.priority = t.Priority
        if (t.Tags && !t.tags) t.tags = t.Tags
        if (t['Due Date'] && !t.dueDate) t.dueDate = t['Due Date']
        if (t.ID && !t.originalId) t.originalId = t.ID
        return t
      }).filter(t => t.title)
    }

    const normalized = normalizeTodos(rows)
    const parents = normalized
    const children: Record<string, unknown>[] = []

    const userId = extractUserIdFromPrefixed(session.user.id)

    const importId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const baseKey = `import:${userId}:${importId}`

    await Promise.all([
      redis.setex(`${baseKey}:parents`, TTL_SEC, JSON.stringify(parents)),
      redis.setex(`${baseKey}:children`, TTL_SEC, JSON.stringify(children)),
      // 初期化段階では既存取得を行わず、各チャンク処理側で必要に応じて補う
      redis.setex(`${baseKey}:existing`, TTL_SEC, JSON.stringify([])),
      redis.setex(`${baseKey}:idmap`, TTL_SEC, JSON.stringify({})),
      redis.setex(`${baseKey}:status`, TTL_SEC, JSON.stringify({
        stage: 'ready',
        parents: { total: parents.length, processed: 0, imported: 0, skipped: 0 },
        children: { total: children.length, processed: 0, imported: 0, skipped: 0 }
      }))
    ])

    return NextResponse.json({ importId, total: normalized.length, parents: parents.length, children: children.length })
  } catch (e) {
    const error = e as Error
    return NextResponse.json({ error: error?.message || 'Init failed' }, { status: 500 })
  }
}
