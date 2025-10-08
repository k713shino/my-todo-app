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
    const [parentsRaw, existingRaw, idmapRaw, statusRaw] = await Promise.all([
      redis.get(`${baseKey}:parents`),
      redis.get(`${baseKey}:existing`),
      redis.get(`${baseKey}:idmap`),
      redis.get(`${baseKey}:status`),
    ])
    if (!parentsRaw || !statusRaw) return NextResponse.json({ error: 'Import not found or expired' }, { status: 404 })
    const parents: Record<string, unknown>[] = JSON.parse(parentsRaw)
    const existing: Record<string, unknown>[] = existingRaw ? JSON.parse(existingRaw) : []
    const idmap: Record<string, string> = idmapRaw ? JSON.parse(idmapRaw) : {}
    const status = JSON.parse(statusRaw) as Record<string, unknown>
    status.stage = 'parents'

    const slice = parents.slice(cursor, cursor + limit)
    let imported = 0
    let skipped = 0

    // 既存インデックス（簡易）
    const indexByTitle = new Map<string, Record<string, unknown>[]>()
    for (const e of existing) {
      const k = normalizeStr(e.title as string)
      const arr = indexByTitle.get(k) || []
      arr.push(e)
      indexByTitle.set(k, arr)
    }

    const isDup = (t: Record<string, unknown>): Record<string, unknown> | null => {
      // externalId/Source があればそれを優先
      if (t.externalId) {
        const c = existing.find((e: Record<string, unknown>) => (e.externalId || null) === t.externalId && (!t.externalSource || (e.externalSource || null) === t.externalSource))
        if (c) return c
      }
      const key = normalizeStr(t.title as string)
      const cand = [ ...(indexByTitle.get(key) || []) ]
      const tTokens = tokenize(t.title as string)
      let best: Record<string, unknown> | null = null
      let bestScore = 0
      for (const c of cand) {
        const score = jaccard(tTokens, tokenize(c.title as string))
        const exact = normalizeStr(c.title as string) === key
        const strongSimilar = score >= 0.9
        const dateOk = eqDay(t.dueDate as string | null | undefined ?? null, c.dueDate as string | null | undefined ?? null)
        const catOk = eqNullable(t.category as string | null | undefined ?? null, c.category as string | null | undefined ?? null)
        if ((exact || strongSimilar) && dateOk && catOk) {
          if (score > bestScore) { best = c; bestScore = score }
        }
      }
      return best
    }

    for (const item of slice) {
      const dup = isDup(item)
      if (dup) {
        skipped++
        if (item.originalId) idmap[String(item.originalId)] = String(dup.id)
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
        externalId: item.externalId || undefined,
        externalSource: item.externalSource || undefined,
      })
      if (res.success && res.data) {
        imported++
        existing.push(res.data as Record<string, unknown>)
        if (item.originalId) idmap[String(item.originalId)] = String((res.data as Record<string, unknown>).id)
      } else {
        skipped++
      }
    }

    cursor += slice.length
    const parents_status = status.parents as Record<string, unknown>
    parents_status.processed = Math.min((parents_status.processed as number) + slice.length, parents_status.total as number)
    parents_status.imported = (parents_status.imported as number) + imported
    parents_status.skipped = (parents_status.skipped as number) + skipped

    await Promise.all([
      redis.setex(`${baseKey}:existing`, TTL_SEC, JSON.stringify(existing)),
      redis.setex(`${baseKey}:idmap`, TTL_SEC, JSON.stringify(idmap)),
      redis.setex(`${baseKey}:status`, TTL_SEC, JSON.stringify(status)),
    ])

    const done = cursor >= parents.length
    return NextResponse.json({ nextCursor: cursor, done, imported, skipped })
  } catch (e) {
    const error = e as Error
    return NextResponse.json({ error: error?.message || 'Parents chunk failed' }, { status: 500 })
  }
}

