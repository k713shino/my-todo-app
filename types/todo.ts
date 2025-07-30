import { Priority } from '@prisma/client'

export interface Todo {
  id: string
  title: string
  description?: string | null
  completed: boolean
  priority: Priority
  category?: string
  tags?: string[]
  dueDate?: Date | null
  createdAt: Date
  updatedAt: Date
  userId: string
}

export interface CreateTodoData {
  title: string
  description?: string
  priority?: Priority
  dueDate?: Date
  category?: string
  tags?: string[]
}

export interface UpdateTodoData {
  title?: string
  description?: string
  completed?: boolean
  priority?: Priority
  dueDate?: Date | null
  category?: string
  tags?: string[]
}

export interface TodoFilters {
  completed?: boolean
  priority?: Priority
  dueBefore?: Date
  dueAfter?: Date
  search?: string
  category?: string
  tags?: string[]
  dateRange?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'overdue' | 'no_due_date'
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
  completed: number
  active: number
  overdue: number
  byPriority: {
    urgent: number
    high: number
    medium: number
    low: number
  }
}
