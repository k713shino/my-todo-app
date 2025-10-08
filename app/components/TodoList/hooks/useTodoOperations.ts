'use client'

import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import type { Todo, CreateTodoData } from '@/types/todo'
import { Status, Priority } from '@prisma/client'
import { safeParseTodoDate } from '@/lib/date-utils'
import {
  retryWithBackoff,
  getErrorMessage,
  isTemporaryError,
  logApiError,
  type ErrorWithStatus
} from '@/lib/error-utils'

/**
 * APIレスポンスのTodoデータ型定義
 */
interface TodoResponse {
  id: string
  title: string
  description?: string | null
  status: Status
  priority: Priority
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  userId: string
  category?: string
  tags: string[]
  completed?: boolean
}

/**
 * Todo更新時のリクエストデータ型定義
 */
interface UpdateTodoData {
  status?: Status
  title?: string
  description?: string
  priority?: Priority
  dueDate?: Date | null
  completed?: boolean
}

/**
 * Todo CRUD操作を管理するカスタムフック
 */
export function useTodoOperations() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lambdaWarmedUp, setLambdaWarmedUp] = useState(false)

  // クライアント側の簡易キャッシュ（localStorage）
  const loadClientCache = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('todos:cache:v1')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed.map((t: TodoResponse) => safeParseTodoDate(t as unknown as Record<string, unknown>))
    } catch { return null }
  }, [])

  const saveClientCache = useCallback((data: TodoResponse[]) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem('todos:cache:v1', JSON.stringify(data))
    } catch { /* ignore */ }
  }, [])

  /**
   * Lambda関数ウォームアップ機能
   */
  const warmupLambda = useCallback(async () => {
    if (lambdaWarmedUp) return

    try {
      console.log('🔥 Lambda関数ウォームアップ開始（バックグラウンド）')
      const warmupStart = performance.now()

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      fetch('/api/lambda/warmup', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      }).then(async (response) => {
        clearTimeout(timeoutId)
        const warmupTime = performance.now() - warmupStart

        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            console.log(`🚀 Lambda関数ウォームアップ完了 (${warmupTime.toFixed(2)}ms)`)
            setLambdaWarmedUp(true)
            setTimeout(() => setLambdaWarmedUp(false), 5 * 60 * 1000)
          } else {
            console.warn('⚠️ Lambda関数ウォームアップ失敗:', result.error)
          }
        }
      }).catch(error => {
        clearTimeout(timeoutId)
        if (error.name !== 'AbortError') {
          console.warn('⚠️ Lambda関数ウォームアップエラー:', error)
        }
      })
    } catch (error) {
      console.warn('⚠️ Lambda関数ウォームアップエラー:', error)
    }
  }, [lambdaWarmedUp])

  /**
   * サーバーからTodo一覧を取得
   */
  const fetchTodos = useCallback(async (bypassCache = false, advancedSearchParams?: Record<string, string>) => {
    const startTime = performance.now()

    try {
      console.log('⚡ 高速Todo取得開始:', { bypassCache, 現在のTodos数: todos.length })

      let url = ''
      if (advancedSearchParams && Object.keys(advancedSearchParams).length > 0) {
        const params = new URLSearchParams(advancedSearchParams)
        if (bypassCache) params.set('_t', String(Date.now()))
        url = `/api/todos/search?${params.toString()}`
      } else {
        url = bypassCache
          ? `/api/todos/user?cache=false&_t=${Date.now()}`
          : `/api/todos/user`
      }

      const response = await retryWithBackoff(async () => {
        const fetchStart = performance.now()
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        const res = await fetch(url, {
          ...(bypassCache ? {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          } : {
            cache: 'default'
          }),
          signal: controller.signal,
        })
        clearTimeout(timer)
        const fetchTime = performance.now() - fetchStart
        if (process.env.NODE_ENV !== 'production') {
          console.log(`📡 API呼び出し時間: ${fetchTime.toFixed(2)}ms`)
        }
        return res
      }, {
        maxRetries: 2,
        shouldRetry: (error: Error) => {
          const errorWithStatus = error as ErrorWithStatus
          return error.name === 'TypeError' ||
                 (errorWithStatus.status !== undefined && errorWithStatus.status >= 500)
        }
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const dataJson = await response.json()
      const data: TodoResponse[] = Array.isArray(dataJson) ? dataJson : (dataJson.results || [])
      const totalTime = performance.now() - startTime

      const performanceLevel = totalTime < 500 ? '🟢 高速' :
                              totalTime < 1000 ? '🟡 普通' : '🔴 要改善'

      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Todo取得完了 (${totalTime.toFixed(2)}ms) ${performanceLevel}:`, {
          todoCount: data.length,
          cacheStatus: response.headers.get('X-Cache-Status'),
          apiResponseTime: response.headers.get('X-Response-Time'),
          lambdaWarmedUp
        })
      }

      const parsedTodos = data.map((todo) => safeParseTodoDate(todo as unknown as Record<string, unknown>))
      setTodos(parsedTodos as unknown as Todo[])
      saveClientCache(parsedTodos as unknown as TodoResponse[])

      if (totalTime > 1000 && process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ パフォーマンス警告: 読み込みに${totalTime.toFixed(2)}msかかりました`)
        if (!lambdaWarmedUp) {
          warmupLambda()
        }
      }

    } catch (error) {
      const totalTime = performance.now() - startTime
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, `Todo取得 (${totalTime.toFixed(2)}ms)`)

      if (!lambdaWarmedUp) {
        warmupLambda()
      }

      // キャッシュからのフォールバック取得
      try {
        console.log('🔄 キャッシュからのフォールバック取得を試行...')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const cachedResponse = await fetch('/api/todos/user?cache=true', { signal: controller.signal })
        clearTimeout(timer)
        if (cachedResponse.ok) {
          const cachedData = await cachedResponse.json()
          if (Array.isArray(cachedData) && cachedData.length > 0) {
            const parsedTodos = cachedData.map((todo: TodoResponse) => safeParseTodoDate(todo as unknown as Record<string, unknown>))
            setTodos(parsedTodos as unknown as Todo[])
            toast.success('📦 キャッシュからデータを復旧しました')
            setTimeout(() => { try { fetchTodos(true) } catch {} }, 15000)
            return
          }
        }
      } catch (fallbackError) {
        console.warn('キャッシュからの復旧も失敗:', fallbackError)
      }

      // ローカルキャッシュから復旧
      try {
        const local = loadClientCache()
        if (local && local.length > 0) {
          setTodos(local as unknown as Todo[])
          toast.success('💾 ローカルキャッシュから復旧しました')
          setTimeout(() => { try { fetchTodos(true) } catch {} }, 20000)
          return
        }
      } catch {}

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }, [todos.length, lambdaWarmedUp, warmupLambda, saveClientCache, loadClientCache])

  /**
   * SWR対応: キャッシュ優先の高速取得
   */
  const fetchTodosSWRFast = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1200)
      const res = await fetch('/api/todos/user?cache=true', { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const cachedData = await res.json()
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          const parsed = cachedData.map((t: TodoResponse) => safeParseTodoDate(t as unknown as Record<string, unknown>))
          setTodos(parsed as unknown as Todo[])
          setIsLoading(false)
          setTimeout(() => { try { fetchTodos(true) } catch {} }, 0)
          return
        }
      }
    } catch {}
    await fetchTodos(false)
  }, [fetchTodos])

  /**
   * 新規Todoの作成
   */
  const handleCreateTodo = useCallback(async (data: CreateTodoData) => {
    setIsSubmitting(true)

    const tempId = `temp-${Date.now()}`
    const optimisticTodo: Todo = {
      id: tempId,
      title: data.title,
      description: data.description || null,
      status: data.status || 'TODO',
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'current-user',
      category: data.category || undefined,
      tags: data.tags || []
    }

    console.log('🔵 楽観的UI更新 - 追加:', { tempId, title: data.title })
    setTodos(prev => [optimisticTodo, ...prev])

    try {
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        try {
          return await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const newTodo: TodoResponse = await response.json()
      console.log('✅ API成功レスポンス:', newTodo)

      setTodos(prev => prev.map(todo => {
        if (todo.id === tempId) {
          return safeParseTodoDate({ ...newTodo })
        }
        return todo
      }))
      toast.success('📝 新しいTodoを作成しました！')

      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}

      try {
        fetch('/api/cache?type=user', { method: 'DELETE' }).catch(() => {})
      } catch {}

    } catch (error) {
      setTodos(prev => prev.filter(todo => todo.id !== tempId))

      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo作成')

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo作成エラー: ${friendlyMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  /**
   * Todoの更新
   */
  const handleUpdateTodo = useCallback(async (id: string, data: UpdateTodoData) => {
    const originalTodos = todos
    setTodos(prev => prev.map(todo =>
      todo.id === id
        ? { ...todo, ...data, updatedAt: new Date() }
        : todo
    ))

    // 進行中タイマーのタイトルも即時反映
    try {
      const runningId = (typeof window !== 'undefined') ? localStorage.getItem('time:runningTodoId') : null
      const updateData = data as CreateTodoData
      if (runningId && String(runningId) === String(id) && updateData?.title) {
        localStorage.setItem('time:runningTitle', String(updateData.title))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('time:runningChanged'))
        }
      }
    } catch {/* ignore */}

    try {
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15_000)
        try {
          return await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      const updatedTodo: TodoResponse = await response.json()
      console.log('✅ 更新成功:', updatedTodo)

      setTodos(prev => prev.map(todo =>
        todo.id === id ? safeParseTodoDate(updatedTodo as unknown as Record<string, unknown>) as unknown as Todo : todo
      ))

      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}

      try {
        fetch('/api/cache?type=user', { method: 'DELETE' }).catch(() => {})
      } catch {}

    } catch (error) {
      setTodos(originalTodos)

      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo更新')

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo更新エラー: ${friendlyMessage}`)
    }
  }, [todos])

  /**
   * Todoの削除
   */
  const handleDeleteTodo = useCallback(async (id: string) => {
    const originalTodos = todos
    setTodos(prev => prev.filter(todo => todo.id !== id))

    try {
      const response = await retryWithBackoff(async () => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        try {
          return await fetch(`/api/todos/${id}`, {
            method: 'DELETE',
            signal: controller.signal,
          })
        } finally {
          clearTimeout(timer)
        }
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      toast.success('🗑️ Todoを削除しました')

      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}

      try {
        fetch('/api/cache?type=user', { method: 'DELETE' }).catch(() => {})
      } catch {}

    } catch (error) {
      setTodos(originalTodos)

      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo削除')

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo削除エラー: ${friendlyMessage}`)
    }
  }, [todos])

  return {
    todos,
    setTodos,
    isLoading,
    setIsLoading,
    isSubmitting,
    fetchTodos,
    fetchTodosSWRFast,
    handleCreateTodo,
    handleUpdateTodo,
    handleDeleteTodo,
  }
}
