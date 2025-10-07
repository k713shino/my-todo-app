'use client'

import { useState, useMemo } from 'react'
import type { Todo } from '@/types/todo'
import { Priority } from '@prisma/client'

// 優先度の数値マッピング（ソート用）
const PRIORITY_ORDER: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

/**
 * Todoソート機能を管理するカスタムフック
 */
export function useTodoSorting() {
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  /**
   * Todoリストをソート
   */
  const sortTodos = useMemo(() => {
    return (todos: Todo[]) => {
      const sorted = [...todos].sort((a, b) => {
        // 完了済み(status: DONE)は常に下に配置
        const aCompleted = a.status === 'DONE'
        const bCompleted = b.status === 'DONE'
        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1
        }

        let compareValue = 0

        switch (sortBy) {
          case 'createdAt':
            compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            break
          case 'dueDate':
            // 期限なしは最後に配置
            if (!a.dueDate && !b.dueDate) compareValue = 0
            else if (!a.dueDate) compareValue = 1
            else if (!b.dueDate) compareValue = -1
            else compareValue = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            break
          case 'priority':
            compareValue = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
            break
        }

        return sortOrder === 'asc' ? compareValue : -compareValue
      })

      return sorted
    }
  }, [sortBy, sortOrder])

  return {
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    sortTodos,
  }
}
