import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { redis } from '@/lib/redis'
import { lambdaAPI } from '@/lib/lambda-api'
import { normalizeStr, tokenize, jaccard, eqDay, eqNullable } from '@/lib/import-utils'

const TTL_SEC = parseInt(process.env.IMPORT_TTL_SEC || '1800', 10)
const DEFAULT_LIMIT = parseInt(process.env.IMPORT_CHUNK_SIZE || '100', 10)

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = extractUserIdFromPrefixed(session.user.id)

    const body = await request.json()
    const importId: string = body.importId
    let cursor: number = Number(body.cursor || 0)
    const limit: number = Math.max(1, Number(body.limit || DEFAULT_LIMIT))
    if (!importId) return NextResponse.json({ error: 'importId required' }, { status: 400 })

    const baseKey = `import:${userId}:${importId}`
    const [childrenRaw, existingRaw, idmapRaw, statusRaw] = await Promise.all([
      redis.get(`${baseKey}:children`),
      redis.get(`${baseKey}:existing`),
      redis.get(`${baseKey}:idmap`),
      redis.get(`${baseKey}:status`),
    ])
    if (!childrenRaw || !statusRaw) return NextResponse.json({ error: 'Import not found or expired' }, { status: 404 })
    const children: any[] = JSON.parse(childrenRaw)
    const existing: any[] = existingRaw ? JSON.parse(existingRaw) : []
    const idmap: Record<string, string> = idmapRaw ? JSON.parse(idmapRaw) : {}
    const status = JSON.parse(statusRaw)
    status.stage = 'children'

    const slice = children.slice(cursor, cursor + limit)
    let imported = 0
    let skipped = 0

    // 既存インデックス
    const indexByTitle = new Map<string, any[]>()
    for (const e of existing) {
      const k = normalizeStr(e.title)
      const arr = indexByTitle.get(k) || []
      arr.push(e)
      indexByTitle.set(k, arr)
    }

    const isDup = (t: any, parentId: string): any | null => {
      if (t.externalId) {
        const c = existing.find((e: any) => (e.externalId || null) === t.externalId && (!t.externalSource || (e.externalSource || null) === t.externalSource) && (e.parentId ? String(e.parentId) : null) === parentId)
        if (c) return c
      }
      const key = normalizeStr(t.title)
      const cand = [ ...(indexByTitle.get(key) || []) ].filter(e => (e.parentId ? String(e.parentId) : null) === parentId)
      const tTokens = tokenize(t.title)
      let best: any | null = null
      let bestScore = 0
      for (const c of cand) {
        const score = jaccard(tTokens, tokenize(c.title))
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

    for (const item of slice) {
      const parentOrig = String(item.parentOriginalId)
      const parentId = idmap[parentOrig]
      if (!parentId) { skipped++; continue }

      const dup = isDup(item, parentId)
      if (dup) {
        skipped++
        continue
      }

      const res = await lambdaAPI.post('/todos', {
        title: item.title,
        description: item.description || undefined,
        userId,
        userEmail: session.user.email || undefined,
        userName: session.user.name || undefined,
        priority: item.priority || 'MEDIUM',
        status: item.status || 'TODO',
        dueDate: item.dueDate || undefined,
        category: item.category || undefined,
        tags: Array.isArray(item.tags) ? item.tags : undefined,
        parentId,
        externalId: item.externalId || undefined,
        externalSource: item.externalSource || undefined,
      })
      if (res.success && res.data) {
        imported++
        existing.push(res.data)
      } else {
        skipped++
      }
    }

    cursor += slice.length
    status.children.processed = Math.min(status.children.processed + slice.length, status.children.total)
    status.children.imported += imported
    status.children.skipped += skipped

    await Promise.all([
      redis.setex(`${baseKey}:existing`, TTL_SEC, JSON.stringify(existing)),
      redis.setex(`${baseKey}:status`, TTL_SEC, JSON.stringify(status)),
    ])

    const done = cursor >= children.length
    return NextResponse.json({ nextCursor: cursor, done, imported, skipped })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Children chunk failed' }, { status: 500 })
  }
}

