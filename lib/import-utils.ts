import { NextResponse } from 'next/server'

// CSVパーサ（既存の import-data と同等の仕様）
export function parseCSVText(text: string): { headers: string[]; rows: string[][] } {
  if (!text) return { headers: [], rows: [] }
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
      else if (ch === '\r') { /* ignore CR */ }
      else { field += ch }
    }
  }
  row.push(field); rows.push(row)
  const nonEmpty = rows.filter(r => r.some(c => c.trim().length > 0))
  const headers = (nonEmpty[0] || []).map(h => h.trim())
  const dataRows = nonEmpty.slice(1)
  return { headers, rows: dataRows }
}

export const normalizePriority = (val: any): string => {
  const pRaw = (val || '').toString()
  const p = pRaw.toUpperCase()
  if ([ 'LOW','MEDIUM','HIGH','URGENT' ].includes(p)) return p
  const lower = pRaw.toLowerCase()
  if ([ 'low','medium','high','urgent' ].includes(lower)) return lower.toUpperCase()
  return 'MEDIUM'
}

export const normalizeStatus = (val: any, completed?: boolean): string => {
  const sRaw = (val || '').toString()
  const s = sRaw.toUpperCase()
  if (['TODO','IN_PROGRESS','REVIEW','DONE'].includes(s)) return s
  if (completed === true) return 'DONE'
  if (completed === false) return 'TODO'
  return 'TODO'
}

export const normalizeArrayTags = (tags: any): string[] => {
  return Array.isArray(tags)
    ? tags
    : (typeof tags === 'string' && tags.length > 0
        ? tags.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [])
}

export const normalizeTodos = (todoData: any[]): any[] => {
  return todoData.map(todo => {
    const normalized: any = {
      title: todo.title || 'Untitled',
      description: todo.description || '',
      status: normalizeStatus(todo.status, todo.completed),
      priority: normalizePriority(todo.priority),
      category: todo.category || null,
      dueDate: todo.dueDate ? new Date(todo.dueDate).toISOString() : null,
      tags: normalizeArrayTags(todo.tags)
    }
    if (todo.completed !== undefined) normalized.completed = Boolean(todo.completed)
    if (todo.originalId || todo.id) normalized.originalId = todo.originalId || todo.id
    if (todo.createdAt) normalized.originalCreatedAt = todo.createdAt
    if (todo.updatedAt) normalized.originalUpdatedAt = todo.updatedAt
    // 外部IDメタ
    if (todo.externalId) normalized.externalId = String(todo.externalId)
    if (todo.externalSource) normalized.externalSource = String(todo.externalSource)
    return normalized
  }).filter(todo => String(todo.title).trim().length > 0)
}

// 文字列正規化・トークン化・簡易重複判定（既存ロジックに準拠）
export const normalizeStr = (s: string) => (s || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\p{P}\p{S}]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const tokenize = (s: string) => new Set(normalizeStr(s).split(' ').filter(Boolean))

export const jaccard = (a: Set<string>, b: Set<string>) => {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const uni = a.size + b.size - inter
  return uni === 0 ? 1 : inter / uni
}

export const eqDay = (d1?: string | null, d2?: string | null) => {
  if (!d1 && !d2) return true
  if (!d1 || !d2) return false
  const a = new Date(d1)
  const b = new Date(d2)
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return d1 === d2
  const da = `${a.getFullYear()}-${a.getMonth()+1}-${a.getDate()}`
  const db = `${b.getFullYear()}-${b.getMonth()+1}-${b.getDate()}`
  return da === db
}

export const eqNullable = (x?: string | null, y?: string | null) => (x || '') === (y || '')
