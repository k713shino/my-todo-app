import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { lambdaAPI } from '@/lib/lambda-api'
import { extractUserIdFromPrefixed } from '@/lib/user-id-utils'
import { Todo, TodoFilters } from '@/types/todo'
import { safeToISOString } from '@/lib/date-utils'
import { Priority, Status } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 フロントエンドAPI GET /api/todos/search 呼び出し開始');
    
    const session = await getAuthSession()
    
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // 既存フィルタ（後方互換）
    const filters: TodoFilters = {
      search: searchParams.get('q') || undefined,
      completed: searchParams.get('completed') ? searchParams.get('completed') === 'true' : undefined,
      priority: searchParams.get('priority') as Priority || undefined,
      category: searchParams.get('category') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      dateRange: searchParams.get('dateRange') as any || undefined,
    }

    // スマートフィルタv2 拡張パラメータ
    const fieldsParam = (searchParams.get('fields') || 'title,description,category,tags').split(',').map(s => s.trim()).filter(Boolean)
    const regexParam = searchParams.get('regex') || undefined // 例: 
    // - regex=/foo.*/i （全フィールド）
    // - regex=title:/^feat/i （特定フィールド）
    const statusParam = searchParams.get('status') || undefined // 例: status=TODO,IN_PROGRESS
    const tagsAllParam = searchParams.get('tags_all') || undefined // すべて含む
    const scoreWeightsParam = searchParams.get('weights') || undefined // JSON: {titleExact:5,...}
    const exprParam = searchParams.get('expr') || undefined // JSON複合条件

    type Expr = 
      | { op: 'and' | 'or'; conds: Expr[] }
      | { field: 'title'|'description'|'category'|'status'|'priority'|'tags'|'dueDate'; 
          type: 'eq'|'neq'|'contains'|'regex'|'in'|'range';
          value?: any; from?: string; to?: string; flags?: string }

    const parseExprJSON = (raw?: string): Expr | undefined => {
      if (!raw) return undefined
      try { return JSON.parse(raw) as Expr } catch { return undefined }
    }

    // 正規表現の解析
    const parseRegex = (raw?: string): { field?: string; re: RegExp } | undefined => {
      if (!raw) return undefined
      try {
        // 形式1: /pattern/flags
        if (raw.startsWith('/') && raw.lastIndexOf('/') > 0) {
          const last = raw.lastIndexOf('/')
          const pat = raw.slice(1, last)
          const flags = raw.slice(last + 1)
          return { re: new RegExp(pat, flags) }
        }
        // 形式2: field:/pattern/flags
        const m = raw.match(/^([a-zA-Z_]+):\/(.*)\/(\w*)$/)
        if (m) {
          return { field: m[1], re: new RegExp(m[2], m[3]) }
        }
      } catch {}
      return undefined
    }

    const parsedRegex = parseRegex(regexParam)
    const expr = parseExprJSON(exprParam)

    // スコアの重み（デフォルト）
    const defaultWeights = {
      titleExact: 6,
      titlePartial: 3,
      descPartial: 1,
      categoryMatch: 1,
      tagMatch: 2,
      regexBonus: 2,
      overdue: 3,
      dueSoon: 2,
      priorityUrgent: 4,
      priorityHigh: 2,
      donePenalty: -2,
    }
    const weights = (() => {
      if (!scoreWeightsParam) return defaultWeights
      try { return { ...defaultWeights, ...JSON.parse(scoreWeightsParam) } } catch { return defaultWeights }
    })()

    console.log('🔍 検索フィルター:', filters);
    console.log('👤 現在のユーザー:', session.user.id);

    // ユーザー専用エンドポイントを利用（確実・高速）
    const actualUserId = extractUserIdFromPrefixed(session.user.id)
    console.log('📡 Lambda API ユーザーTodo取得開始:', actualUserId)
    let userTodos: any[] = []
    try {
      userTodos = await lambdaAPI.getUserTodos(actualUserId)
    } catch (e) {
      console.error('❌ Lambda getUserTodos 失敗:', e)
      return NextResponse.json({ 
        filters, results: [], count: 0, error: 'Failed to fetch user todos' 
      }, { status: 500 })
    }
    console.log('📊 ユーザー固有Todo件数:', userTodos.length)

    // 検索フィルタリング適用
    let filteredTodos = userTodos;

    // 状態の複数指定（例: status=TODO,IN_PROGRESS）
    if (statusParam) {
      const wanted = new Set(statusParam.split(',').map(s => s.trim()).filter(Boolean))
      if (wanted.size > 0) {
        filteredTodos = filteredTodos.filter((todo: any) => {
          const s = todo.status ? String(todo.status) : (todo.completed ? 'DONE' : 'TODO')
          return wanted.has(s)
        })
        console.log(`🎯 ステータス複数フィルター ${[...wanted].join(',')} 結果:`, filteredTodos.length)
      }
    }

    // 全文検索
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filteredTodos = filteredTodos.filter((todo: any) => {
        return (
          todo.title?.toLowerCase().includes(searchTerm) ||
          todo.description?.toLowerCase().includes(searchTerm) ||
          todo.category?.toLowerCase().includes(searchTerm)
        );
      });
      console.log(`🔍 全文検索 "${filters.search}" 結果:`, filteredTodos.length, '件');
    }

    // 完了状態フィルター
    if (filters.completed !== undefined) {
      filteredTodos = filteredTodos.filter((todo: any) => todo.completed === filters.completed);
      console.log(`✅ 完了状態フィルター "${filters.completed}" 結果:`, filteredTodos.length, '件');
    }

    // 優先度フィルター
    if (filters.priority) {
      filteredTodos = filteredTodos.filter((todo: any) => todo.priority === filters.priority);
      console.log(`⚡ 優先度フィルター "${filters.priority}" 結果:`, filteredTodos.length, '件');
    }

    // カテゴリフィルター
    if (filters.category) {
      const categoryTerm = filters.category.toLowerCase();
      filteredTodos = filteredTodos.filter((todo: any) => 
        todo.category?.toLowerCase().includes(categoryTerm)
      );
      console.log(`📁 カテゴリフィルター "${filters.category}" 結果:`, filteredTodos.length, '件');
    }

    // タグフィルター（いずれか）
    if (filters.tags && filters.tags.length > 0) {
      filteredTodos = filteredTodos.filter((todo: any) => {
        const todoTags = Array.isArray(todo.tags) ? todo.tags : [];
        return filters.tags!.some(tag => todoTags.includes(tag));
      });
      console.log(`🏷️ タグフィルター "${filters.tags.join(',')}" 結果:`, filteredTodos.length, '件');
    }

    // タグフィルター（すべて含む）
    if (tagsAllParam) {
      const must = tagsAllParam.split(',').map(s => s.trim()).filter(Boolean)
      if (must.length > 0) {
        filteredTodos = filteredTodos.filter((todo: any) => {
          const todoTags = Array.isArray(todo.tags) ? todo.tags : []
          return must.every(tag => todoTags.includes(tag))
        })
        console.log(`🏷️ タグ(AND) "${must.join(',')}" 結果:`, filteredTodos.length, '件')
      }
    }

    // 日付範囲フィルター
    if (filters.dateRange) {
      const now = new Date();
      
      if (filters.dateRange === 'overdue') {
        filteredTodos = filteredTodos.filter((todo: any) => {
          return todo.dueDate && new Date(todo.dueDate) < now && !todo.completed;
        });
      } else if (filters.dateRange === 'today') {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        filteredTodos = filteredTodos.filter((todo: any) => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= todayStart && dueDate < todayEnd;
        });
      } else if (filters.dateRange === 'this_week') {
        const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        filteredTodos = filteredTodos.filter((todo: any) => {
          if (!todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate <= weekEnd;
        });
      } else if (filters.dateRange === 'no_due_date') {
        filteredTodos = filteredTodos.filter((todo: any) => !todo.dueDate);
      }
      
      console.log(`📅 日付範囲フィルター "${filters.dateRange}" 結果:`, filteredTodos.length, '件');
    }

    // 正規表現フィルタ
    if (parsedRegex) {
      const fields = parsedRegex.field ? [parsedRegex.field] : fieldsParam
      filteredTodos = filteredTodos.filter((todo: any) => {
        return fields.some((f) => {
          const v = f === 'tags' ? (Array.isArray(todo.tags) ? todo.tags.join(' ') : '') : String(todo[f] ?? '')
          return parsedRegex!.re.test(v)
        })
      })
      console.log(`🧪 正規表現フィルター ${parsedRegex.field ? parsedRegex.field+':' : ''}${parsedRegex.re} 結果:`, filteredTodos.length)
    }

    // 複合条件（JSON）
    const applyExpr = (t: any, e?: Expr): boolean => {
      if (!e) return true
      if ((e as any).op) {
        const node = e as any
        const results = (node.conds || []).map((c: Expr) => applyExpr(t, c))
        return node.op === 'and' ? results.every(Boolean) : results.some(Boolean)
      }
      const c = e as any
      const get = (field: string): any => {
        if (field === 'tags') return Array.isArray(t.tags) ? t.tags : []
        return t[field]
      }
      switch (c.type) {
        case 'eq': return String(get(c.field)) === String(c.value)
        case 'neq': return String(get(c.field)) !== String(c.value)
        case 'contains': {
          const v = get(c.field)
          return String(v ?? '').toLowerCase().includes(String(c.value ?? '').toLowerCase())
        }
        case 'regex': {
          try {
            const re = new RegExp(String(c.value ?? ''), c.flags || '')
            const v = c.field === 'tags' ? (Array.isArray(t.tags) ? t.tags.join(' ') : '') : String(get(c.field) ?? '')
            return re.test(v)
          } catch { return false }
        }
        case 'in': {
          const arr = Array.isArray(c.value) ? c.value.map((x: any) => String(x)) : []
          const v = get(c.field)
          return arr.includes(String(v))
        }
        case 'range': {
          // 日付範囲用
          const v = get(c.field)
          if (!v) return false
          const dt = new Date(v)
          const fromOk = c.from ? dt >= new Date(c.from) : true
          const toOk = c.to ? dt <= new Date(c.to) : true
          return fromOk && toOk
        }
        default: return true
      }
    }
    if (expr && filteredTodos.length > 0) {
      filteredTodos = filteredTodos.filter(t => applyExpr(t, expr))
      console.log('🧩 複合条件(expr) 適用後:', filteredTodos.length)
    }

    // 重み付きスコア（v2）
    const tokens = (filters.search || '').trim().split(/\s+/).filter(Boolean)
    const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 } as const
    const now = new Date()
    const withScore = filteredTodos.map((t: any) => {
      let score = 0
      const title = String(t.title || '')
      const desc = String(t.description || '')
      const category = String(t.category || '')
      const tagStr = Array.isArray(t.tags) ? t.tags.join(' ') : ''

      // 正規表現一致ボーナス（既にフィルタしているが、スコアにも加点）
      if (parsedRegex) {
        const fields = parsedRegex.field ? [parsedRegex.field] : fieldsParam
        if (fields.some(f => parsedRegex.re.test(f === 'tags' ? tagStr : String((t as any)[f] ?? '')))) {
          score += weights.regexBonus
        }
      }

      // クエリトークンの一致
      for (const token of tokens) {
        const low = token.toLowerCase()
        if (title.toLowerCase() === low) score += weights.titleExact
        else if (title.toLowerCase().includes(low)) score += weights.titlePartial
        if (desc.toLowerCase().includes(low)) score += weights.descPartial
        if (category.toLowerCase().includes(low)) score += weights.categoryMatch
        if (tagStr.toLowerCase().includes(low)) score += weights.tagMatch
      }

      // 期限: 24時間以内 or 期限切れ
      if (t.dueDate) {
        const due = new Date(t.dueDate)
        if (due < now && !(t.completed || t.status === 'DONE')) score += weights.overdue
        else if (due.getTime() - now.getTime() <= 24*60*60*1000 && due >= now) score += weights.dueSoon
      }

      // 優先度
      const p = String(t.priority || 'MEDIUM')
      if (p === 'URGENT') score += weights.priorityUrgent
      else if (p === 'HIGH') score += weights.priorityHigh

      // 完了ペナルティ（明示指定がない場合）
      if ((filters.completed === undefined) && (t.completed || t.status === 'DONE')) score += weights.donePenalty

      return { t, score }
    })

    withScore.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // タイブレーク: 未完了優先 → 優先度 → 期限 → 更新日
      const aC = a.t.completed || a.t.status === 'DONE'
      const bC = b.t.completed || b.t.status === 'DONE'
      if (aC !== bC) return aC ? 1 : -1
      const aP = priorityOrder[a.t.priority as keyof typeof priorityOrder] || 2
      const bP = priorityOrder[b.t.priority as keyof typeof priorityOrder] || 2
      if (aP !== bP) return bP - aP
      if (a.t.dueDate && b.t.dueDate) return new Date(a.t.dueDate).getTime() - new Date(b.t.dueDate).getTime()
      if (a.t.dueDate && !b.t.dueDate) return -1
      if (!a.t.dueDate && b.t.dueDate) return 1
      return new Date(b.t.updatedAt).getTime() - new Date(a.t.updatedAt).getTime()
    })

    // まずマッチしたタスク集合（親・子を含む）を取得
    const matchedTodos = withScore.map(x => x.t)

    // 親を含めるルール:
    // - 親がマッチした場合はその親を含める
    // - 子（サブタスク）がマッチした場合も、その親を一覧に含める（親自身が直接マッチしていなくても可）
    const idToTodo = new Map<string, any>(userTodos.map((t: any) => [String(t.id), t]))
    const idToScore = new Map<string, number>(withScore.map(ws => [String(ws.t.id), ws.score]))
    const includeParentIds = new Set<string>()
    const matchedSubtasksByParent = new Map<string, any[]>()

    for (const t of matchedTodos) {
      if (!t.parentId) {
        includeParentIds.add(String(t.id))
      } else {
        const p = String(t.parentId)
        includeParentIds.add(p)
        const arr = matchedSubtasksByParent.get(p) || []
        arr.push(t)
        matchedSubtasksByParent.set(p, arr)
      }
    }

    // 親タスクのみを作成し、子のマッチ数に応じて少しスコア加点
    const childMatchBoost = 1
    type ParentEntry = { parent: any; aggScore: number }
    const parentEntries: ParentEntry[] = []
    for (const pid of includeParentIds) {
      const parent = idToTodo.get(pid)
      if (!parent) continue
      const base = idToScore.get(pid) || 0
      const childMatches = matchedSubtasksByParent.get(pid) || []
      const aggScore = base + childMatches.length * childMatchBoost
      parentEntries.push({ parent, aggScore })
    }

    parentEntries.sort((a, b) => {
      if (b.aggScore !== a.aggScore) return b.aggScore - a.aggScore
      // タイブレークは従来どおり: 未完了優先 → 優先度 → 期限 → 更新日
      const aC = a.parent.completed || a.parent.status === 'DONE'
      const bC = b.parent.completed || b.parent.status === 'DONE'
      if (aC !== bC) return aC ? 1 : -1
      const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 } as const
      const aP = priorityOrder[a.parent.priority as keyof typeof priorityOrder] || 2
      const bP = priorityOrder[b.parent.priority as keyof typeof priorityOrder] || 2
      if (aP !== bP) return bP - aP
      if (a.parent.dueDate && b.parent.dueDate) return new Date(a.parent.dueDate).getTime() - new Date(b.parent.dueDate).getTime()
      if (a.parent.dueDate && !b.parent.dueDate) return -1
      if (!a.parent.dueDate && b.parent.dueDate) return 1
      return new Date(b.parent.updatedAt).getTime() - new Date(a.parent.updatedAt).getTime()
    })

    filteredTodos = parentEntries.map(e => e.parent)

    // 安全な日付変換
    const results = filteredTodos.map((todo: any) => ({
      ...todo,
      createdAt: safeToISOString(todo.createdAt),
      updatedAt: safeToISOString(todo.updatedAt),
      dueDate: todo.dueDate ? safeToISOString(todo.dueDate) : null,
      priority: todo.priority || 'MEDIUM',
      category: todo.category || null,
      tags: todo.tags || []
    }));

    console.log('✅ 検索完了:', {
      totalTodos: userTodos.length,
      userTodos: userTodos.length,
      filteredResults: results.length,
      filters
    });

    return NextResponse.json({
      filters,
      results,
      count: results.length,
      cached: false, // Lambda経由なのでキャッシュなし
      meta: {
        weights,
        regex: regexParam || null,
        fields: fieldsParam,
        hasExpr: !!expr,
        matchedSubtasks: Object.fromEntries(
          Array.from(matchedSubtasksByParent.entries()).map(([pid, subs]) => [pid, subs.map((s: any) => ({ id: s.id, title: s.title, status: s.status }))])
        )
      }
    })

  } catch (error) {
    console.error('❌ 検索処理で例外発生:', error)
    return NextResponse.json({ 
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
