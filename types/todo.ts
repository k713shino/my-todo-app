import { Priority } from '@prisma/client'

export interface Todo {
  id: string
  title: string
  description?: string | null
  completed: boolean
  priority: Priority
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
}

export interface UpdateTodoData {
  title?: string
  description?: string
  completed?: boolean
  priority?: Priority
  dueDate?: Date | null
}

export interface TodoFilters {
  completed?: boolean
  priority?: Priority
  dueBefore?: Date
  dueAfter?: Date
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
