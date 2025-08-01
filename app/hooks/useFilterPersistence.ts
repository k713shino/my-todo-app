'use client'

import { useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { TodoFilters } from '@/types/todo'

const STORAGE_KEY = 'todo_filters'

/**
 * フィルター条件の永続化フック
 * localStorage とURL クエリパラメータの両方を使用
 */
export function useFilterPersistence() {
  const router = useRouter()
  const searchParams = useSearchParams()

  /**
   * URL からフィルター条件を読み込み
   */
  const loadFiltersFromURL = useCallback((): TodoFilters => {
    const filters: TodoFilters = {}
    
    const search = searchParams.get('q')
    if (search) filters.search = search
    
    const completed = searchParams.get('completed')
    if (completed !== null) filters.completed = completed === 'true'
    
    const priority = searchParams.get('priority')
    if (priority) filters.priority = priority as any
    
    const category = searchParams.get('category')
    if (category) filters.category = category
    
    const tags = searchParams.get('tags')
    if (tags) filters.tags = tags.split(',').filter(Boolean)
    
    const dateRange = searchParams.get('dateRange')
    if (dateRange) filters.dateRange = dateRange as any
    
    return filters
  }, [searchParams])

  /**
   * localStorage からフィルター条件を読み込み
   */
  const loadFiltersFromStorage = useCallback((): TodoFilters => {
    if (typeof window === 'undefined') return {}
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error)
      return {}
    }
  }, [])

  /**
   * フィルター条件を localStorage に保存
   */
  const saveFiltersToStorage = useCallback((filters: TodoFilters) => {
    if (typeof window === 'undefined') return
    
    try {
      // 空のフィルターは保存しない
      const hasFilters = Object.keys(filters).some(key => 
        filters[key as keyof TodoFilters] !== undefined && 
        filters[key as keyof TodoFilters] !== '' &&
        !(Array.isArray(filters[key as keyof TodoFilters]) && (filters[key as keyof TodoFilters] as any[]).length === 0)
      )
      
      if (hasFilters) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error)
    }
  }, [])

  /**
   * フィルター条件を URL クエリパラメータに反映
   */
  const saveFiltersToURL = useCallback((filters: TodoFilters, replace = false) => {
    const params = new URLSearchParams()
    
    if (filters.search) params.set('q', filters.search)
    if (filters.completed !== undefined) params.set('completed', filters.completed.toString())
    if (filters.priority) params.set('priority', filters.priority)
    if (filters.category) params.set('category', filters.category)
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','))
    if (filters.dateRange) params.set('dateRange', filters.dateRange)
    
    const queryString = params.toString()
    const newURL = queryString ? `?${queryString}` : window.location.pathname
    
    if (replace) {
      router.replace(newURL)
    } else {
      router.push(newURL)
    }
  }, [router])

  /**
   * フィルター条件を永続化（localStorage + URL）
   */
  const persistFilters = useCallback((filters: TodoFilters, updateURL = true) => {
    saveFiltersToStorage(filters)
    if (updateURL) {
      saveFiltersToURL(filters, true) // replace を使用してブラウザ履歴を汚さない
    }
  }, [saveFiltersToStorage, saveFiltersToURL])

  /**
   * 永続化されたフィルター条件を読み込み
   * 優先順位: URL > localStorage
   */
  const loadPersistedFilters = useCallback((): TodoFilters => {
    // まず URL から読み込み
    const urlFilters = loadFiltersFromURL()
    const hasURLFilters = Object.keys(urlFilters).length > 0
    
    if (hasURLFilters) {
      // URL にフィルターがある場合は localStorage にも保存
      saveFiltersToStorage(urlFilters)
      return urlFilters
    }
    
    // URL にフィルターがない場合は localStorage から読み込み
    return loadFiltersFromStorage()
  }, [loadFiltersFromURL, loadFiltersFromStorage, saveFiltersToStorage])

  /**
   * 永続化データをクリア
   */
  const clearPersistedFilters = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
    router.replace(window.location.pathname)
  }, [router])

  return {
    persistFilters,
    loadPersistedFilters,
    clearPersistedFilters,
    saveFiltersToURL,
    loadFiltersFromURL,
  }
}