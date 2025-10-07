import { Priority, Status } from '@prisma/client'

export interface Todo {
  id: string
  title: string
  description?: string | null
  status: Status
  priority: Priority
  category?: string
  tags?: string[]
  dueDate?: Date | null
  createdAt: Date
  updatedAt: Date
  userId: string
  // 外部連携ID（重複検知用）
  externalId?: string | null
  externalSource?: string | null
}

export interface CreateTodoData {
  title: string
  description?: string
  priority?: Priority
  status?: Status
  dueDate?: Date
  category?: string
  tags?: string[]
  // 外部連携ID（任意）。指定されると重複検知に使用されます。
  externalId?: string
  externalSource?: string
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: Status
  priority?: Priority
  dueDate?: Date | null
  category?: string
  tags?: string[]
  externalId?: string | null
  externalSource?: string | null
}

export interface TodoFilters {
  status?: Status | Status[]
  priority?: Priority
  dueBefore?: Date
  dueAfter?: Date
  search?: string
  category?: string
  tags?: string[]
  dateRange?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'overdue' | 'no_due_date'
  // 後方互換性のため一時的にcompletedも残す
  completed?: boolean
}

export interface SavedSearch {
  id: string
  name: string
  filters: string // JSON string of TodoFilters
  createdAt: Date
  userId: string
}

export interface SearchHistory {
  id: string
  query: string
  filters: string // JSON string of TodoFilters
  timestamp: Date
  userId: string
}

export interface TodoStats {
  total: number
  byStatus: {
    todo: number
    inProgress: number
    review: number
    done: number
  }
  overdue: number
  byPriority: {
    urgent: number
    high: number
    medium: number
    low: number
  }
  // カテゴリ分布
  categoryBreakdown?: Record<string, number>
  // 週次完了推移（直近N週）
  weeklyTrend?: Array<{
    label: string // 例: M/D〜
    count: number
  }>
  // 週次推移のメタ情報
  trendMeta?: {
    weeks: number
    weekStart: 'mon' | 'sun'
    tz: 'UTC' | 'local'
  }
  // 月次完了推移（直近Nか月）
  monthlyTrend?: Array<{
    label: string // 例: YYYY/MM or M月
    count: number
  }>
  // 月次推移のメタ情報
  monthMeta?: {
    months: number
    tz: 'UTC' | 'local'
  }
  // 後方互換性のため
  completed: number
  active: number
  // 追加メタ
  weeklyDone?: number
  monthlyDone?: number
  unavailable?: boolean
}
