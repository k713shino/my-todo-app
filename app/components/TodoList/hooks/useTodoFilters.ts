'use client'

import { useState, useMemo, useCallback } from 'react'
import type { Todo, TodoFilters } from '@/types/todo'
import { Status } from '@prisma/client'

// 後方互換性のため、completedの概念をstatusに変換
const isCompleted = (status: Status): boolean => status === 'DONE'

interface UseTodoFiltersProps {
  todos: Todo[]
}

/**
 * Todoフィルタリングを管理するカスタムフック
 */
export function useTodoFilters({ todos }: UseTodoFiltersProps) {
  const [filter, setFilterInternal] = useState<TodoFilters>({})

  /**
   * スクロール位置保持機能付きのsetFilter
   */
  const setFilter = useCallback((newFilter: TodoFilters) => {
    console.log('🎯 setFilter実行 (スクロール保持付き):', newFilter)

    // スクロール位置を保存
    const scrollTop = typeof window !== 'undefined'
      ? (window.pageYOffset || document.documentElement.scrollTop)
      : 0
    const scrollLeft = typeof window !== 'undefined'
      ? (window.pageXOffset || document.documentElement.scrollLeft)
      : 0

    // フィルターを更新
    setFilterInternal(newFilter)

    // スクロール位置を復元
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo(scrollLeft, scrollTop)
      })
    }
  }, [])

  /**
   * クライアントサイドフィルタリング
   */
  const applyFilters = useCallback((allTodos: Todo[], filters: TodoFilters) => {
    // 早期リターン: フィルターが空の場合
    if (Object.keys(filters).length === 0) {
      return allTodos
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 フィルター適用開始:', { 全件数: allTodos.length, フィルター: filters })
    }

    let filtered = allTodos

    // テキスト検索
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase().trim()
      filtered = filtered.filter(todo =>
        todo.title.toLowerCase().includes(searchTerm) ||
        (todo.description && todo.description.toLowerCase().includes(searchTerm))
      )
      if (process.env.NODE_ENV === 'development') {
        console.log(`📝 テキスト検索 "${searchTerm}":`, filtered.length, '件')
      }
    }

    // ステータスフィルター
    if (filters.status !== undefined) {
      if (Array.isArray(filters.status)) {
        filtered = filtered.filter(todo => filters.status!.includes(todo.status))
      } else {
        filtered = filtered.filter(todo => todo.status === filters.status)
      }
      console.log(`📊 ステータス "${filters.status}":`, filtered.length, '件')
    }

    // 後方互換性: completedフィルター
    if (filters.completed !== undefined) {
      filtered = filtered.filter(todo => isCompleted(todo.status) === filters.completed)
      console.log(`✅ 完了状態 "${filters.completed}":`, filtered.length, '件')
    }

    // 優先度フィルター
    if (filters.priority) {
      filtered = filtered.filter(todo => todo.priority === filters.priority)
      console.log(`⚡ 優先度 "${filters.priority}":`, filtered.length, '件')
    }

    // カテゴリフィルター
    if (filters.category && filters.category.trim()) {
      const categoryTerm = filters.category.toLowerCase().trim()
      filtered = filtered.filter(todo =>
        todo.category && todo.category.toLowerCase().includes(categoryTerm)
      )
      console.log(`📂 カテゴリ "${filters.category}":`, filtered.length, '件')
    }

    // タグフィルター
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(todo => {
        const todoTags = todo.tags || []
        return filters.tags!.some(tag => todoTags.includes(tag))
      })
      console.log(`🏷️ タグ "${filters.tags.join(',')}":`, filtered.length, '件')
    }

    // 日付範囲フィルター
    if (filters.dateRange) {
      const now = new Date()

      if (filters.dateRange === 'overdue') {
        filtered = filtered.filter(todo =>
          todo.dueDate && new Date(todo.dueDate) < now && !isCompleted(todo.status)
        )
      } else if (filters.dateRange === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= todayStart && dueDate < todayEnd
        })
      } else if (filters.dateRange === 'tomorrow') {
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= tomorrowStart && dueDate < tomorrowEnd
        })
      } else if (filters.dateRange === 'this_week') {
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay())
        weekStart.setHours(0, 0, 0, 0)

        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= weekStart && dueDate < weekEnd
        })
      } else if (filters.dateRange === 'next_week') {
        const nextWeekStart = new Date(now)
        nextWeekStart.setDate(now.getDate() - now.getDay() + 7)
        nextWeekStart.setHours(0, 0, 0, 0)

        const nextWeekEnd = new Date(nextWeekStart)
        nextWeekEnd.setDate(nextWeekStart.getDate() + 7)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextWeekStart && dueDate < nextWeekEnd
        })
      } else if (filters.dateRange === 'this_month') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= monthStart && dueDate < monthEnd
        })
      } else if (filters.dateRange === 'next_month') {
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1)

        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextMonthStart && dueDate < nextMonthEnd
        })
      } else if (filters.dateRange === 'no_due_date') {
        filtered = filtered.filter(todo => !todo.dueDate)
      }
      console.log(`📅 日付範囲 "${filters.dateRange}":`, filtered.length, '件')
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ フィルター適用完了:', filtered.length, '件')
    }
    return filtered
  }, [])

  /**
   * フィルタリング済みのTodoリストをメモ化
   */
  const filteredTodos = useMemo(() => {
    return applyFilters(todos, filter)
  }, [todos, filter, applyFilters])

  return {
    filter,
    setFilter,
    filteredTodos,
    applyFilters,
  }
}
