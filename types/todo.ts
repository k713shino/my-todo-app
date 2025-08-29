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
  // サブタスク関連
  parentId?: string | null
  subtasks?: Todo[]
  _count?: {
    subtasks: number
  }
}

export interface CreateTodoData {
  title: string
  description?: string
  priority?: Priority
  status?: Status
  dueDate?: Date
  category?: string
  tags?: string[]
  parentId?: string  // サブタスク作成時の親ID
}

export interface UpdateTodoData {
  title?: string
  description?: string
  status?: Status
  priority?: Priority
  dueDate?: Date | null
  category?: string
  tags?: string[]
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
  // サブタスク統計
  subtasks: {
    total: number
    mainTasks: number  // 親タスク数
    subTasks: number   // サブタスク数
  }
  // 後方互換性のため
  completed: number
  active: number
}
