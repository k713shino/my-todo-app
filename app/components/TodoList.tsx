'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Priority, Status } from '@prisma/client'
import type { Todo, CreateTodoData, TodoStats, TodoFilters } from '@/types/todo'
import TodoForm from './TodoForm'
import TodoItem from './TodoItem'
// import RealtimeUpdates from './RealtimeUpdates'
import { Toaster, toast } from 'react-hot-toast'
import { safeParseTodoDate } from '@/lib/date-utils'
import { 
  retryWithBackoff, 
  getErrorMessage, 
  isTemporaryError, 
  logApiError,
  type ErrorWithStatus 
} from '@/lib/error-utils'
import { withScrollPreservation } from '../hooks/useScrollPreservation'
import { useDeadlineNotifications } from '@/app/hooks/useDeadlineNotifications'

// 優先度の日本語ラベル
const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  URGENT: '緊急',
}


/**
 * APIレスポンスのTodoデータ型定義
 * バックエンドから返される日付は文字列形式
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
  // データベース互換性のための一時的なフィールド
  completed?: boolean
}

/**
 * Todo更新時のリクエストデータ型定義
 * 各フィールドは任意更新可能
 */
interface UpdateTodoData {
  status?: Status
  title?: string
  description?: string
  priority?: Priority
  dueDate?: Date | null
  completed?: boolean // 一時的な後方互換性
}

/**
 * Todoリストコンポーネント
 *
 * 主な機能:
 * - Todoの一覧表示、作成、更新、削除
 * - 完了状態、優先度、検索キーワードによるフィルタリング
 * - リアルタイム更新
 * - Todo統計情報の表示
 */
// デバッグ用ページ移動監視フック
import { usePageMovementDebugger } from '@/app/hooks/usePageMovementDebugger'

interface TodoListProps {
  modalSearchValues?: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }
  advancedSearchParams?: Record<string, string>
}

// ステータス関連のヘルパー関数（LocalStorage連携版）
const getStatusLabel = (status: Status): string => {
  switch (status) {
    case 'TODO': return '📝 未着手'
    case 'IN_PROGRESS': return '🔄 作業中'
    case 'REVIEW': return '👀 確認中'
    case 'DONE': return '✅ 完了'
    default: return '❓ 不明'
  }
}


const getNextStatus = (currentStatus: Status): Status => {
  switch (currentStatus) {
    case 'TODO': return 'IN_PROGRESS'
    case 'IN_PROGRESS': return 'REVIEW'
    case 'REVIEW': return 'DONE'
    case 'DONE': return 'TODO'
    default: return 'TODO'
  }
}

// 後方互換性のため、completedの概念をstatusに変換
const isCompleted = (status: Status): boolean => status === 'DONE'

// 以前のLocalStorage依存のコードを削除し、APIレスポンスを直接使用

export default function TodoList({ modalSearchValues, advancedSearchParams }: TodoListProps) {
  // ページ移動デバッグ開始
  usePageMovementDebugger()

  const [todos, setTodos] = useState<Todo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const newFormRef = useRef<HTMLInputElement | null>(null)
  const [filter, setFilterInternal] = useState<TodoFilters>({})
  
  // ソート機能のstate
  const [sortBy, setSortBy] = useState<'createdAt' | 'dueDate' | 'priority'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc') // 新しい順がデフォルト
  
  // タブビューのstate
  const [activeView, setActiveView] = useState<'all' | 'status' | 'calendar' | 'kanban'>('all')
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // ドラッグ&ドロップ用のstate
  const [draggedTodo, setDraggedTodo] = useState<Todo | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  
  // バルク操作用のstate
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isBulkOperating, setIsBulkOperating] = useState(false)
  // サブタスク変更の反映（ロールアップ再取得用デバウンス）
  const subtaskRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSubtasksChanged = () => {
    if (subtaskRefreshTimerRef.current) {
      clearTimeout(subtaskRefreshTimerRef.current)
    }
    subtaskRefreshTimerRef.current = setTimeout(() => {
      fetchTodos(true).catch(() => {})
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
    }, 300)
  }
  
  // カレンダー用ヘルパー関数
  const getCalendarDays = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    
    // 月の最初の日と最後の日を取得
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    // カレンダー表示用の開始日（前月の日曜日から）
    const startDate = new Date(firstDayOfMonth)
    startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())
    
    // カレンダー表示用の終了日（翌月の土曜日まで）
    const endDate = new Date(lastDayOfMonth)
    endDate.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()))
    
    const days = []
    const currentDateLoop = new Date(startDate)
    
    while (currentDateLoop <= endDate) {
      days.push(new Date(currentDateLoop))
      currentDateLoop.setDate(currentDateLoop.getDate() + 1)
    }
    
    return days
  }
  
  const getTodosForDate = (date: Date) => {
    return filteredTodos.filter(todo => {
      if (!todo.dueDate) return false
      const todoDate = new Date(todo.dueDate)
      return todoDate.toDateString() === date.toDateString()
    })
  }
  
  // スクロール位置保持機能付きのsetFilter
  const setFilter = withScrollPreservation((newFilter: TodoFilters) => {
    console.log('🎯 setFilter実行 (スクロール保持付き):', newFilter)
    setFilterInternal(newFilter)
  })
  const [lambdaWarmedUp, setLambdaWarmedUp] = useState(false)
  // マウント後の判定（高度検索クリア時に通常一覧へ戻すため）
  const didMountRef = useRef(false)
  // 締切通知（ユーザーが許可すれば動作）
  // 通知タイミング（分）をローカル設定から読み込む
  const [notifyMinutes, setNotifyMinutes] = useState<number>(15)
  useEffect(() => {
    try {
      const m = localStorage.getItem('notify:deadline:minutes')
      if (m) setNotifyMinutes(Math.max(1, parseInt(m)))
    } catch {}
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'notify:deadline:minutes' && e.newValue) {
        setNotifyMinutes(Math.max(1, parseInt(e.newValue)))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const { enabled: deadlineNotifyEnabled, requestPermission: requestDeadlinePermission } = useDeadlineNotifications(todos, { minutesBefore: notifyMinutes, intervalMs: 60_000 })

  // 通知からのディープリンク（?focus=<id>）に対応: 高信頼のスクロール＆ハイライト（リトライ付き）
  const lastFocusedRef = useRef<string | null>(null)
  const focusTodoById = useCallback((id: string, maxAttempts = 30, interval = 100) => {
    let attempts = 0
    const tryOnce = () => {
      attempts++
      const sel = `[data-todo-id="${CSS.escape(id)}"]`
      const el = document.querySelector(sel) as HTMLElement | null
      if (el) {
        try {
          // 即時スクロール（高速化）→ 視覚効果
          el.scrollIntoView({ behavior: attempts <= 2 ? 'auto' : 'smooth', block: 'center' })
          const origOutline = el.style.outline
          el.style.outline = '3px solid #facc15'
          el.style.outlineOffset = '2px'
          setTimeout(() => {
            el.style.outline = origOutline
            el.style.outlineOffset = ''
          }, 1600)
          lastFocusedRef.current = id
          // URLのfocusを除去
          try {
            const sp = new URLSearchParams(window.location.search)
            if (sp.get('focus') === id) {
              sp.delete('focus')
              const newUrl = window.location.pathname + (sp.toString() ? `?${sp.toString()}` : '')
              window.history.replaceState(null, '', newUrl)
            }
          } catch {}
          return true
        } catch { /* ignore */ }
      }
      if (attempts < maxAttempts) {
        setTimeout(tryOnce, interval)
      }
      return false
    }
    return tryOnce()
  }, [])

  const scheduleFocusFromURL = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      const focusId = sp.get('focus')
      if (focusId && focusId !== lastFocusedRef.current) {
        focusTodoById(focusId)
      }
    } catch {}
  }, [focusTodoById])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // todos更新のたびに再試行（要素がまだ描画されていない可能性のため）
    scheduleFocusFromURL()
  }, [todos, scheduleFocusFromURL])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPop = () => scheduleFocusFromURL()
    const onMsg = (e: MessageEvent) => {
      try {
        if (e && e.data && e.data.type === 'focus-todo' && e.data.todoId) {
          const id = String(e.data.todoId)
          focusTodoById(id)
        }
      } catch {}
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('message', onMsg)
    }
  }, [focusTodoById, scheduleFocusFromURL])

  // クライアント側の簡易キャッシュ（localStorage）
  const loadClientCache = () => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('todos:cache:v1')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return null
      return parsed.map((t: any) => safeParseTodoDate(t))
    } catch { return null }
  }
  const saveClientCache = (data: any[]) => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem('todos:cache:v1', JSON.stringify(data))
    } catch { /* ignore */ }
  }

  // モーダルからの検索値をフィルターに反映
  useEffect(() => {
    if (modalSearchValues) {
      const newFilter: TodoFilters = {
        search: modalSearchValues.keyword || '',
        category: modalSearchValues.category || '',
        tags: modalSearchValues.tags.length > 0 ? modalSearchValues.tags : undefined,
        completed: modalSearchValues.completed,
        priority: modalSearchValues.priority as Priority | undefined,
        dateRange: (modalSearchValues.dateRange as TodoFilters['dateRange']) || undefined
      }
      
      // 空の値は除去
      Object.keys(newFilter).forEach(key => {
        const value = (newFilter as any)[key]
        if (!value || (Array.isArray(value) && value.length === 0) || value === '') {
          delete (newFilter as any)[key]
        }
      })
      
      console.log('🔍 モーダル検索値をフィルターに反映:', newFilter)
      setFilter(newFilter)
    }
  }, [modalSearchValues])

  /**
   * Lambda関数ウォームアップ機能
   * コールドスタート問題を軽減
   */
  const warmupLambda = async () => {
    if (lambdaWarmedUp) return // 既にウォームアップ済み
    
    try {
      console.log('🔥 Lambda関数ウォームアップ開始（バックグラウンド）')
      const warmupStart = performance.now()
      
      // 非同期でウォームアップ実行（UI をブロックしない）
      // タイムアウトを追加して、ハングしないように改善
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10秒タイムアウト
      
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
            
            // 5分後にウォームアップ状態をリセット（再ウォームアップのため）
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
  }

  /**
   * サーバーからTodo一覧を取得
   * 取得したデータの日付文字列をDateオブジェクトに変換
   * 改善されたエラーハンドリングとリトライ機能付き
   */
  const fetchTodos = async (bypassCache = false) => {
    const startTime = performance.now()
    
    try {
      console.log('⚡ 高速Todo取得開始:', { bypassCache, 現在のTodos数: todos.length });
      
      // 🚀 高度検索パラメータがある場合は検索APIを使用
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
      
      // リトライ機能付きの高速フェッチ
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
        shouldRetry: (error) => {
          // ネットワークエラーまたは5xx系エラーのみリトライ
          return error.name === 'TypeError' || 
                 (error as any).status >= 500
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
      
      // パフォーマンス分析
      const performanceLevel = totalTime < 500 ? '🟢 高速' : 
                              totalTime < 1000 ? '🟡 普通' : '🔴 要改善'
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ Todo取得完了 (${totalTime.toFixed(2)}ms) ${performanceLevel}:`, {
          todoCount: data.length,
          cacheStatus: response.headers.get('X-Cache-Status'),
          apiResponseTime: response.headers.get('X-Response-Time'),
          lambdaWarmedUp
        });
      }
      
      const parsedTodos = data.map((todo) => {
        const parsed = safeParseTodoDate(todo)
        // APIから直接ステータスを使用（LocalStorage依存を削除）
        return parsed
      })
      setTodos(parsedTodos)
      // クライアントキャッシュにも保存
      saveClientCache(parsedTodos)
      
      // パフォーマンスが1秒を超えた場合の警告
      if (totalTime > 1000 && process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️ パフォーマンス警告: 読み込みに${totalTime.toFixed(2)}msかかりました`)
        
        // Lambda関数のウォームアップを次回のために実行
        if (!lambdaWarmedUp) {
          warmupLambda()
        }
      }
      
    } catch (error) {
      const totalTime = performance.now() - startTime
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, `Todo取得 (${totalTime.toFixed(2)}ms)`)
      
      // エラー後にウォームアップを試行（次回のパフォーマンス向上のため）
      if (!lambdaWarmedUp) {
        warmupLambda()
      }
      
      // キャッシュからのフォールバック取得を試行（バイパス指定時も試す）
      try {
        console.log('🔄 キャッシュからのフォールバック取得を試行...')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const cachedResponse = await fetch('/api/todos/user?cache=true', { signal: controller.signal })
        clearTimeout(timer)
        if (cachedResponse.ok) {
          const cachedData = await cachedResponse.json()
          if (Array.isArray(cachedData) && cachedData.length > 0) {
            const parsedTodos = cachedData.map((todo: TodoResponse) => safeParseTodoDate(todo))
            setTodos(parsedTodos)
            toast.success('📦 キャッシュからデータを復旧しました')
            // バックグラウンドで再試行（最新化）
            setTimeout(() => { try { fetchTodos(true) } catch {} }, 15000)
            return
          }
        }
      } catch (fallbackError) {
        console.warn('キャッシュからの復旧も失敗:', fallbackError)
      }

      // さらにローカルキャッシュがあれば最後の砦として復旧
      try {
        const local = loadClientCache()
        if (local && local.length > 0) {
          setTodos(local)
          toast.success('💾 ローカルキャッシュから復旧しました')
          // バックグラウンドで再試行（最新化）
          setTimeout(() => { try { fetchTodos(true) } catch {} }, 20000)
          return
        }
      } catch {}

      // ここまで到達したらフォールバック失敗 → エラーを通知
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(friendlyMessage)
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * SWR完全対応: まずキャッシュのみ（超高速）→ バックグラウンドで最新化
   * - 先に /api/todos/user?cache=true を短いタイムアウトで叩いて即描画
   * - その後 /api/todos/user?cache=false で最新化し、成功時に差し替え
   */
  const fetchTodosSWRFast = async () => {
    try {
      // 1) キャッシュのみ（サーバーRedis）を短タイムアウトで取得
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 1200)
      const res = await fetch('/api/todos/user?cache=true', { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const cachedData = await res.json()
        if (Array.isArray(cachedData) && cachedData.length > 0) {
          const parsed = cachedData.map((t: TodoResponse) => safeParseTodoDate(t))
          setTodos(parsed)
          setIsLoading(false)
          // 2) バックグラウンドで最新化（失敗してもUXは維持）
          setTimeout(() => { try { fetchTodos(true) } catch {} }, 0)
          return
        }
      }
    } catch {}
    // キャッシュが無い/失敗時は通常ルート（SWR内蔵）へフォールバック
    await fetchTodos(false)
  }

  /**
   * 新規Todoの作成
   * 改善されたエラーハンドリング付き
   */
  const handleCreateTodo = async (data: CreateTodoData) => {
    setIsSubmitting(true)
    
    // 楽観的UI更新：即座に新しいTodoをUIに追加
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
    
    console.log('🔵 楽観的UI更新 - 追加:', { tempId, title: data.title });
    setTodos(prev => [optimisticTodo, ...prev])
    
    // 楽観的更新（LocalStorage依存を削除）
    
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
      console.log('✅ API成功レスポンス:', newTodo);
      
      // 一時的なTodoを実際のTodoで置き換え（APIレスポンスを直接使用）
      setTodos(prev => prev.map(todo => {
        if (todo.id === tempId) {
          const parsed = safeParseTodoDate({ ...newTodo })
          return parsed
        }
        return todo
      }))
      toast.success('📝 新しいTodoを作成しました！')
      // ダッシュボード統計の即時更新通知
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      
      // キャッシュはサーバー側でも無効化されるため、フロントでは非同期で実行（UIブロック回避）
      try {
        fetch('/api/cache?type=user', { method: 'DELETE' }).catch(() => {})
      } catch {}
      
    } catch (error) {
      // エラー時は楽観的更新を取り消し
      setTodos(prev => prev.filter(todo => todo.id !== tempId))
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo作成')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo作成エラー: ${friendlyMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * Todoの更新
   * 改善されたエラーハンドリング付き
   */
  const handleUpdateTodo = async (id: string, data: UpdateTodoData) => {
    // 楽観的UI更新：即座にUIを更新
    const originalTodos = todos
    setTodos(prev => prev.map(todo => 
      todo.id === id 
        ? { ...todo, ...data, updatedAt: new Date() }
        : todo
    ))
    // 楽観的更新: 進行中タイマーのタイトルも即時反映
    try {
      const runningId = (typeof window !== 'undefined') ? localStorage.getItem('time:runningTodoId') : null
      if (runningId && String(runningId) === String(id) && (data as any)?.title) {
        localStorage.setItem('time:runningTitle', String((data as any).title))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('time:runningChanged'))
        }
      }
    } catch {}
    
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
      // 実際のレスポンスでUIを更新（既存のロールアップ/件数は保持）
      setTodos(prev => prev.map(todo => {
        if (todo.id === id) {
          const parsed = safeParseTodoDate({ ...updatedTodo })
          return {
            ...todo,           // 既存フィールド（_count, rollup など）維持
            ...parsed,         // サーバーからの最新値で上書き
            _count: todo._count,
            rollup: todo.rollup,
          }
        }
        return todo
      }))
      // 進行中タイマーのタイトルを即時更新（編集前の名称が残らないように）
      try {
        const runningId = (typeof window !== 'undefined') ? localStorage.getItem('time:runningTodoId') : null
        if (runningId && String(runningId) === String(id)) {
          const newTitle = (updatedTodo as any)?.title || (data as any)?.title
          if (newTitle) {
            localStorage.setItem('time:runningTitle', String(newTitle))
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('time:runningChanged'))
            }
          }
        }
      } catch {}
      toast.success('✅ Todoを更新しました！')
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      
      // キャッシュはサーバー側でも無効化されるため、フロントでは非同期で実行（UIブロック回避）
      try {
        fetch('/api/cache?type=user', { method: 'DELETE' }).catch(() => {})
      } catch {}
      
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo更新')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo更新エラー: ${friendlyMessage}`)
    }
  }

  /**
   * ドラッグ&ドロップハンドラー
   */
  const handleDragStart = (e: React.DragEvent, todo: Todo) => {
    try {
      setDraggedTodo(todo)
      
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', todo.id)
      }
      
      // ドラッグ開始時の視覚的フィードバック
      const target = e.currentTarget as HTMLElement
      if (target) {
        target.classList.add('opacity-50')
      }
      
      console.log('🎨 ドラッグ開始:', { todoId: todo.id, title: todo.title })
    } catch (error) {
      console.error('❌ ドラッグスタートエラー:', error)
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    try {
      setDraggedTodo(null)
      setDragOverColumn(null)
      
      const target = e.currentTarget as HTMLElement
      if (target) {
        target.classList.remove('opacity-50')
      }
      
      console.log('🏁 ドラッグ終了')
    } catch (error) {
      console.error('❌ ドラッグエンドエラー:', error)
      // エラー時も状態をリセット
      setDraggedTodo(null)
      setDragOverColumn(null)
    }
  }

  const handleDragOver = (e: React.DragEvent, status: Status) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move'
      }
      
      setDragOverColumn(status)
    } catch (error) {
      console.error('❌ ドラッグオーバーエラー:', error)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // 子要素から出る場合は無視
    if ((e.target as Element).closest('[data-drop-zone="true"]') === e.currentTarget) {
      return
    }
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, targetStatus: Status) => {
    try {
      e.preventDefault()
      e.stopPropagation()
      
      setDragOverColumn(null)
      
      if (!draggedTodo) {
        console.warn('⚠️ ドラッグ中のTodoが見つかりません')
        return
      }
      
      // 同じステータスの場合は何もしない
      if (draggedTodo.status === targetStatus) {
        console.log('🚀 同じステータスのためスキップ:', targetStatus)
        return
      }

      console.log('🎯 ドラッグ&ドロップ:', {
        todoId: draggedTodo.id,
        from: draggedTodo.status,
        to: targetStatus
      })

      // ステータスを更新
      handleUpdateTodo(draggedTodo.id, { status: targetStatus })
      setDraggedTodo(null)
      
    } catch (error) {
      console.error('❌ ドラッグ&ドロップエラー:', error)
      setDraggedTodo(null)
      setDragOverColumn(null)
    }
  }

  /**
   * Todoの削除
   * 改善されたエラーハンドリング付き
   */
  const handleDeleteTodo = async (id: string) => {
    // 楽観的UI更新：即座にUIから削除
    const originalTodos = todos
    setTodos(prev => prev.filter(todo => todo.id !== id))
    
    try {
      console.log('🗑️ Todo削除開始:', id)
      
      const response = await retryWithBackoff(async () => {
        return await fetch(`/api/todos/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      }, {
        maxRetries: 2,
        shouldRetry: (error) => isTemporaryError(error as ErrorWithStatus)
      })

      console.log('📡 削除レスポンス:', response.status, response.statusText)

      if (!response.ok) {
        const errorWithStatus = new Error(`HTTP ${response.status}`) as ErrorWithStatus
        errorWithStatus.status = response.status
        errorWithStatus.statusText = response.statusText
        throw errorWithStatus
      }

      toast.success('🗑️ Todoを削除しました！')
      try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      
      // 削除成功（LocalStorage依存を削除）
      
      // キャッシュをクリアして次回取得時に最新データを取得
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        console.log('✨ キャッシュクリア完了')
      } catch (error) {
        console.log('⚠️ キャッシュクリア失敗:', error)
      }
      
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      
      // エラー時の処理（LocalStorage依存を削除）
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'Todo削除')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`Todo削除エラー: ${friendlyMessage}`)
    }
  }

  /**
   * バルク操作関数群
   */
  // 過負荷防止のため、同時実行数を制限する軽量ワーカー
  const runWithConcurrency = async <T,>(
    items: T[],
    worker: (item: T, index: number) => Promise<void>,
    limit = Math.max(1, parseInt(process.env.NEXT_PUBLIC_BULK_CONCURRENCY || '4', 10))
  ) => {
    let cursor = 0
    const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
      while (true) {
        const myIndex = cursor++
        if (myIndex >= items.length) break
        await worker(items[myIndex], myIndex)
      }
    })
    await Promise.all(workers)
  }
  // 全選択・全解除
  const handleSelectAll = () => {
    if (selectedTodos.size === filteredTodos.length) {
      setSelectedTodos(new Set())
    } else {
      setSelectedTodos(new Set(filteredTodos.map(todo => todo.id)))
    }
  }
  
  // 個別選択・解除
  const handleSelectTodo = (todoId: string) => {
    const newSelected = new Set(selectedTodos)
    if (newSelected.has(todoId)) {
      newSelected.delete(todoId)
    } else {
      newSelected.add(todoId)
    }
    setSelectedTodos(newSelected)
  }
  
  // 選択モード切り替え
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    if (isSelectionMode) {
      setSelectedTodos(new Set())
    }
  }
  
  // バルクステータス更新
  const handleBulkStatusUpdate = async (targetStatus: Status) => {
    if (selectedTodos.size === 0) {
      toast.error('更新するTodoを選択してください')
      return
    }
    
    setIsBulkOperating(true)
    const selectedIds = Array.from(selectedTodos)
    const originalTodos = todos
    
    try {
      console.log(`🚀 バルクステータス更新開始: ${selectedIds.length}件 → ${targetStatus}`)
      
      // 楽観的更新
      setTodos(prev => prev.map(todo => 
        selectedIds.includes(todo.id) 
          ? { ...todo, status: targetStatus, updatedAt: new Date() }
          : todo
      ))
      
      // サーバサイド一括更新API で高速化
      let okCount = 0
      let failCount = 0
      try {
        const resp = await fetch('/api/todos/batch-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds, data: { status: targetStatus } })
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        okCount = data.count || selectedIds.length
      } catch {
        failCount = selectedIds.length
      }
      
      if (failCount === 0) {
        toast.success(`✅ ${okCount}件のTodoを${targetStatus === 'DONE' ? '完了' : targetStatus === 'TODO' ? '未着手' : targetStatus === 'IN_PROGRESS' ? '作業中' : '確認中'}に更新しました`)
      } else if (okCount > 0) {
        toast.success(`⚠️ ${okCount}件更新成功（${failCount}件は失敗）`)
      } else {
        toast.error('❌ 一括更新に失敗しました')
      }
      
      // 選択をクリア
      setSelectedTodos(new Set())
      
      // キャッシュクリア後、少し待ってからデータ再取得
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        // キャッシュクリア後に少し待機してからサーバデータを取得
        await new Promise(resolve => setTimeout(resolve, 200))
        await fetchTodos(true)
        
        // データ再取得完了後にダッシュボード統計の即時更新通知
        await new Promise(resolve => setTimeout(resolve, 100))
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      } catch (error) {
        console.log('⚠️ キャッシュクリアまたはデータ再取得失敗:', error)
        // データ再取得に失敗した場合も、楽観的更新の状態を維持してダッシュボード更新
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      }
      
    } catch (error) {
      // エラー時は元の状態に戻す
      setTodos(originalTodos)
      
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'バルクステータス更新')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`バルク更新エラー: ${friendlyMessage}`)
    } finally {
      setIsBulkOperating(false)
    }
  }
  
  // バルク削除
  const handleBulkDelete = async () => {
    if (selectedTodos.size === 0) {
      toast.error('削除するTodoを選択してください')
      return
    }
    
    if (!confirm(`選択された${selectedTodos.size}件のTodoを削除しますか？この操作は取り消せません。`)) {
      return
    }
    
    setIsBulkOperating(true)
    const selectedIds = Array.from(selectedTodos)
    const originalTodos = todos
    
    try {
      console.log(`🗑️ バルク削除開始: ${selectedIds.length}件`)
      
      // まずサーバーサイド削除を実行
      let okCount = 0
      let failCount = 0
      try {
        const resp = await fetch('/api/todos/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds })
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        okCount = data.deleted || 0
        failCount = data.failed || 0
        
        console.log(`🗑️ サーバー削除結果: 成功=${okCount}, 失敗=${failCount}`)
      } catch (error) {
        console.error('🗑️ バルク削除API呼び出しエラー:', error)
        failCount = selectedIds.length
      }
      
      // サーバー削除が成功したアイテムのみUIから削除
      if (okCount > 0) {
        // 成功したIDのみを特定（APIレスポンスに成功したIDsが含まれていない場合の対応）
        // 失敗が0の場合は全て成功したと仮定
        const successfulIds = failCount === 0 ? selectedIds : selectedIds.slice(0, okCount)
        
        setTodos(prev => prev.filter(todo => !successfulIds.includes(todo.id)))
        
        if (failCount === 0) {
          toast.success(`🗑️ ${okCount}件のTodoを削除しました`)
        } else {
          toast.success(`⚠️ ${okCount}件削除成功（${failCount}件は失敗）`)
        }
      } else {
        toast.error('❌ 一括削除に失敗しました')
        // 削除が全て失敗した場合はUIを変更しない
        return
      }
      
      // 選択をクリア
      setSelectedTodos(new Set())
      
      // キャッシュクリア後、少し待ってからデータ再取得で整合性を確保
      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        await new Promise(resolve => setTimeout(resolve, 200))
        await fetchTodos(true)
        
        // データ再取得完了後にダッシュボード統計の即時更新通知
        await new Promise(resolve => setTimeout(resolve, 100))
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      } catch (error) {
        console.log('⚠️ キャッシュクリアまたはデータ再取得失敗:', error)
        // データ再取得に失敗した場合もダッシュボード更新は実行
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      }
      
    } catch (error) {
      // エラー時は元の状態に戻す必要はない（楽観的更新をしていないため）
      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'バルク削除')
      
      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`バルク削除エラー: ${friendlyMessage}`)
    } finally {
      setIsBulkOperating(false)
    }
  }

  /**
   * Todo編集フォームの送信処理
   */
  const handleEditSubmit = async (data: CreateTodoData) => {
    if (!editingTodo) return

    setIsSubmitting(true)
    try {
      await handleUpdateTodo(editingTodo.id, data)
      setEditingTodo(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * クライアントサイドフィルタリング - シンプルで確実な動作
   */
  const applyFilters = (allTodos: Todo[], filters: TodoFilters) => {
    // 早期リターン: フィルターが空の場合
    if (Object.keys(filters).length === 0) {
      return allTodos
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 フィルター適用開始:', { 全件数: allTodos.length, フィルター: filters })
    }
    
    // シャローコピーではなく、フィルタリング結果を直接返す
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
        // 期限切れ：期限が過去で未完了
        filtered = filtered.filter(todo => 
          todo.dueDate && new Date(todo.dueDate) < now && !isCompleted(todo.status)
        )
      } else if (filters.dateRange === 'today') {
        // 今日：今日が期限
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= todayStart && dueDate < todayEnd
        })
      } else if (filters.dateRange === 'tomorrow') {
        // 明日：明日が期限
        const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
        const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= tomorrowStart && dueDate < tomorrowEnd
        })
      } else if (filters.dateRange === 'this_week') {
        // 今週：今週中が期限
        const weekStart = new Date(now)
        weekStart.setDate(now.getDate() - now.getDay()) // 今週の日曜日
        weekStart.setHours(0, 0, 0, 0)
        
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 7) // 来週の日曜日
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= weekStart && dueDate < weekEnd
        })
      } else if (filters.dateRange === 'next_week') {
        // 来週：来週中が期限
        const nextWeekStart = new Date(now)
        nextWeekStart.setDate(now.getDate() - now.getDay() + 7) // 来週の日曜日
        nextWeekStart.setHours(0, 0, 0, 0)
        
        const nextWeekEnd = new Date(nextWeekStart)
        nextWeekEnd.setDate(nextWeekStart.getDate() + 7) // 再来週の日曜日
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextWeekStart && dueDate < nextWeekEnd
        })
      } else if (filters.dateRange === 'this_month') {
        // 今月：今月中が期限
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= monthStart && dueDate < monthEnd
        })
      } else if (filters.dateRange === 'next_month') {
        // 来月：来月中が期限
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1)
        
        filtered = filtered.filter(todo => {
          if (!todo.dueDate) return false
          const dueDate = new Date(todo.dueDate)
          return dueDate >= nextMonthStart && dueDate < nextMonthEnd
        })
      } else if (filters.dateRange === 'no_due_date') {
        // 期限なし：期限が設定されていない
        filtered = filtered.filter(todo => !todo.dueDate)
      }
      console.log(`📅 日付範囲 "${filters.dateRange}":`, filtered.length, '件')
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ フィルター適用完了:', filtered.length, '件')
    }
    return filtered
  }


  /**
   * ソート機能
   */
  const sortTodos = (todosToSort: Todo[]) => {
    const sorted = [...todosToSort].sort((a, b) => {
      // 「すべて」タブでは未完了を優先表示
      if (activeView === 'all') {
        // 完了状態が異なる場合は未完了を先に
        const aCompleted = isCompleted(a.status)
        const bCompleted = isCompleted(b.status)
        if (aCompleted !== bCompleted) {
          return aCompleted ? 1 : -1
        }
      }

      let comparison = 0

      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'dueDate':
          // 期限なしのTodoは最後に表示
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          break
        case 'priority':
          const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return sorted
  }

  /**
   * 基本的なクライアントサイドフィルタリング（検索結果の表示用）
   * useMemoを使用して不要な再計算とDOM操作を防止
   */
  const filteredTodos = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 todos, filter, または sort設定 変更検知 (useMemo)')
    }
    // 高度検索使用中はサーバ側でフィルタ済みのため、クライアントフィルタは適用しない
    const usingAdvanced = advancedSearchParams && Object.keys(advancedSearchParams).length > 0
    const filtered = usingAdvanced ? todos : applyFilters(todos, filter)
    const sorted = sortTodos(filtered)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 フィルター・ソート結果:', { 入力件数: todos.length, 出力件数: sorted.length, ソート: `${sortBy} ${sortOrder}`, activeView })
    }
    return sorted
  }, [todos, filter, sortBy, sortOrder, activeView, advancedSearchParams])

  /**
   * Todoの統計情報を計算
   */
  const stats: TodoStats = {
    total: todos.length,
    byStatus: {
      todo: todos.filter(t => t.status === 'TODO').length,
      inProgress: todos.filter(t => t.status === 'IN_PROGRESS').length,
      review: todos.filter(t => t.status === 'REVIEW').length,
      done: todos.filter(t => t.status === 'DONE').length,
    },
    overdue: todos.filter(t => 
      t.dueDate && !isCompleted(t.status) && new Date() > t.dueDate
    ).length,
    byPriority: {
      urgent: todos.filter(t => t.priority === 'URGENT').length,
      high: todos.filter(t => t.priority === 'HIGH').length,
      medium: todos.filter(t => t.priority === 'MEDIUM').length,
      low: todos.filter(t => t.priority === 'LOW').length,
    },
    // サブタスク統計
    subtasks: {
      total: todos.length,
      mainTasks: todos.filter(t => !t.parentId).length,
      subTasks: todos.filter(t => t.parentId).length,
    },
    // 後方互換性
    completed: todos.filter(t => isCompleted(t.status)).length,
    active: todos.filter(t => !isCompleted(t.status)).length,
  }

  /**
   * コンポーネントマウント時の初期化処理
   * Lambda関数のウォームアップも実行
   */
  useEffect(() => {
    const fetchedRef = (window as any).__todosFetchedRef || { current: false }
    ;(window as any).__todosFetchedRef = fetchedRef

    // 先にウォームアップを開始（非同期）
    warmupLambda()

    // クライアントキャッシュがあれば即描画
    const cached = loadClientCache()
    if (cached && cached.length > 0) {
      setTodos(cached)
      setIsLoading(false)
    }

    if (!fetchedRef.current) {
      fetchedRef.current = true
      // 初回読み込みはSWR完全対応の高速ルート
      fetchTodosSWRFast()
    } else {
      // StrictModeなどによる二重発火を抑制
      console.log('ℹ️ 初回取得は既に実行済み（重複防止）')
    }
    // 以降の高度検索パラメータ変更（特にクリア）を検知して再取得できるようにする
    didMountRef.current = true
  }, [])

  // 高度検索条件の変更でサーバ検索を再実行
  // - あり: 検索APIを呼ぶ
  // - なし（クリア）: 通常一覧を再取得（マウント後のみ）
  useEffect(() => {
    const hasAdvanced = advancedSearchParams && Object.keys(advancedSearchParams).length > 0
    if (hasAdvanced) {
      try { fetchTodos(true) } catch {}
    } else if (didMountRef.current) {
      try { fetchTodos(true) } catch {}
    }
  }, [advancedSearchParams])

  // 軽量ショートカットキー
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 入力中は無効化
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      // /: 検索モーダルを開いてキーワードにフォーカス
      if (e.key === '/') {
        e.preventDefault()
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('search:open')) } catch {}
        return
      }

      // n: 新規作成フォームのタイトルへフォーカス
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault()
        try {
          const el = document.querySelector('form input[type="text"]') as HTMLInputElement | null
          el?.focus()
        } catch {}
      }
      // esc: 編集キャンセル
      if (e.key === 'Escape' && editingTodo) {
        e.preventDefault()
        setEditingTodo(null)
      }

      // Ctrl+A: 全選択（選択モードがオフの場合はオンにして全選択）
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        if (!isSelectionMode) {
          setIsSelectionMode(true)
        }
        setSelectedTodos(new Set(filteredTodos.map(t => t.id)))
        return
      }

      // Space / Enter: 完了切替（選択中 or 編集中のタスク）
      if (e.key === ' ' || e.key === 'Enter') {
        // 編集や入力中でなく、選択が存在する場合のみ処理
        e.preventDefault()
        if (selectedTodos.size > 0) {
          // 全選択中の状態から、全てDONEかどうかでトグル
          const selectedList = filteredTodos.filter(t => selectedTodos.has(t.id))
          if (selectedList.length === 0) return
          const allDone = selectedList.every(t => t.status === 'DONE')
          const nextStatus: Status = allDone ? 'TODO' : 'DONE'
          // まとめて更新（既存のバルク機構を使わず1件ずつ呼ぶ）
          selectedList.forEach(t => {
            handleUpdateTodo(t.id, { status: nextStatus })
          })
          return
        }
        if (editingTodo) {
          const nextStatus: Status = editingTodo.status === 'DONE' ? 'TODO' : 'DONE'
          handleUpdateTodo(editingTodo.id, { status: nextStatus })
          return
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingTodo, isSelectionMode, filteredTodos, selectedTodos, handleUpdateTodo])

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400"></div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {lambdaWarmedUp ? '📊 データを読み込み中...' : '🔥 システムを準備中...'}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* 締切通知の有効化スイッチ */}
      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
        <div className="p-3 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm flex items-center justify-between">
          <span>⏰ 期限が近づいたら通知を受け取りますか？</span>
          <button
            onClick={async () => {
              try {
                const ok = await requestDeadlinePermission()
                if (ok) {
                  try { toast.success('通知を有効にしました') } catch {}
                } else {
                  // ブロック（denied）か、その他の失敗
                  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default'
                  if (perm === 'denied') {
                    try { toast.error('通知がブロックされました（ブラウザ設定を確認）') } catch {}
                  } else {
                    try { toast.error('通知を許可できませんでした') } catch {}
                  }
                }
              } catch {
                try { toast.error('通知の有効化でエラーが発生しました') } catch {}
              }
            }}
            className="ml-3 px-3 py-1 rounded bg-yellow-600 text-white hover:bg-yellow-700"
          >
            有効にする
          </button>
        </div>
      )}
      {/* React Hot Toast は GlobalToaster に集約 */}

      {/* 統計の簡易カード（ダッシュボードに統合したため削除） */}

      {/* バルク操作ツールバー */}
      {activeView === 'all' && (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectionMode}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  isSelectionMode 
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {isSelectionMode ? '📋 選択モード終了' : '📋 選択モード'}
              </button>
              
              {isSelectionMode && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span>
                    {selectedTodos.size}件選択中
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="text-purple-600 dark:text-purple-400 hover:underline"
                  >
                    {selectedTodos.size === filteredTodos.length ? '全解除' : '全選択'}
                  </button>
                </div>
              )}
            </div>
            
            {isSelectionMode && selectedTodos.size > 0 && (
              <div className="flex items-center gap-2">
                {/* バルクステータス変更 */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600 dark:text-gray-400">ステータス:</span>
                  <button
                    onClick={() => handleBulkStatusUpdate('TODO')}
                    disabled={isBulkOperating}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                  >
                    📝 未着手
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('IN_PROGRESS')}
                    disabled={isBulkOperating}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 disabled:opacity-50"
                  >
                    🔄 作業中
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('REVIEW')}
                    disabled={isBulkOperating}
                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50 disabled:opacity-50"
                  >
                    👀 確認中
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate('DONE')}
                    disabled={isBulkOperating}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 disabled:opacity-50"
                  >
                    ✅ 完了
                  </button>
                </div>
                
                {/* バルク削除 */}
                <button
                  onClick={handleBulkDelete}
                  disabled={isBulkOperating}
                  className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 disabled:opacity-50"
                >
                  🗑️ 削除
                </button>
                
                {isBulkOperating && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    処理中...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notionライクなタブビュー */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* タブヘッダー */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'all', label: '📋 すべて', icon: '📋' },
            { id: 'status', label: '📊 ステータス別', icon: '📊' },
            { id: 'calendar', label: '📅 カレンダー', icon: '📅' },
            { id: 'kanban', label: '🗂️ かんばん', icon: '🗂️' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as typeof activeView)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeView === view.id
                  ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <span className="text-base">{view.icon}</span>
                <span className="hidden sm:inline">{view.label.split(' ')[1]}</span>
              </span>
              {activeView === view.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400"></div>
              )}
            </button>
          ))}
        </div>

        {/* タブコンテンツ */}
        <div className="p-4">
          {activeView === 'all' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  📋 全てのタスク
                </h3>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* ソート項目選択 */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 dark:text-gray-400">並び順:</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'dueDate' | 'priority')}
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="createdAt">📅 作成日時</option>
                      <option value="dueDate">⏰ 期限日</option>
                      <option value="priority">⚡ 優先度</option>
                    </select>
                  </div>
                  
                  {/* 昇順/降順切り替え */}
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="text-xs px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                  >
                    {sortOrder === 'desc' ? (
                      <>🔽 新しい順</>
                    ) : (
                      <>🔼 古い順</>
                    )}
                  </button>
                </div>
              </div>
              
              {/* 現在のソート状況表示 */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {filteredTodos.length}件のTodoを
                {sortBy === 'createdAt' && '作成日時'}
                {sortBy === 'dueDate' && '期限日'}
                {sortBy === 'priority' && '優先度'}
                の{sortOrder === 'desc' ? '降順' : '昇順'}で表示
              </div>
            </div>
          )}

          {activeView === 'status' && (
            <div className="space-y-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                📊 ステータス別統計表示
              </h3>
              
              {/* 統計サマリー */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { status: 'TODO' as Status, label: '📝 未着手', bgColor: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-300' },
                  { status: 'IN_PROGRESS' as Status, label: '🔄 作業中', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-300' },
                  { status: 'REVIEW' as Status, label: '👀 確認中', bgColor: 'bg-orange-100', textColor: 'text-orange-800', borderColor: 'border-orange-300' },
                  { status: 'DONE' as Status, label: '✅ 完了', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-300' },
                ].map(({ status, label, bgColor, textColor, borderColor }) => {
                  const count = filteredTodos.filter(t => t.status === status).length
                  const percentage = filteredTodos.length > 0 ? Math.round((count / filteredTodos.length) * 100) : 0
                  return (
                    <div key={status} className={`${bgColor} dark:bg-gray-800 rounded-lg p-4 border ${borderColor} dark:border-gray-600`}>
                      <div className={`font-semibold ${textColor} dark:text-gray-200 text-lg`}>
                        {count}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        ({percentage}%)
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* プログレスバー */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">進捗状況</h4>
                <div className="space-y-3">
                  {[
                    { status: 'TODO' as Status, label: '未着手', color: 'gray' },
                    { status: 'IN_PROGRESS' as Status, label: '作業中', color: 'blue' },
                    { status: 'REVIEW' as Status, label: '確認中', color: 'orange' },
                    { status: 'DONE' as Status, label: '完了', color: 'green' },
                  ].map(({ status, label, color }) => {
                    const count = filteredTodos.filter(t => t.status === status).length
                    const percentage = filteredTodos.length > 0 ? (count / filteredTodos.length) * 100 : 0
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <div className="w-16 text-xs text-gray-600 dark:text-gray-400">
                          {label}
                        </div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${
                              color === 'gray' ? 'bg-gray-400' :
                              color === 'blue' ? 'bg-blue-500' :
                              color === 'orange' ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-12 text-xs text-gray-600 dark:text-gray-400 text-right">
                          {count}件
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 簡易リスト表示 */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">最近のアクティビティ（最新5件）</h4>
                <div className="space-y-2">
                  {sortTodos(filteredTodos).slice(0, 5).map(todo => (
                    <div key={todo.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                      <div className={`w-3 h-3 rounded-full ${
                        todo.status === 'TODO' ? 'bg-gray-400' :
                        todo.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                        todo.status === 'REVIEW' ? 'bg-orange-500' :
                        'bg-green-500'
                      }`} />
                      <div 
                        className={`flex-1 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 ${
                          todo.status === 'DONE' ? 'line-through opacity-75' : ''
                        }`}
                        onClick={() => setEditingTodo(todo)}
                      >
                        <div className="font-medium text-sm">{todo.title}</div>
                        {todo.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                            {todo.description}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {format(todo.updatedAt, 'M/d', { locale: ja })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeView === 'calendar' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  📅 カレンダー表示
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[120px] text-center">
                    {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                  </span>
                  <button
                    onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* カレンダーグリッド */}
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* 曜日ヘッダー */}
                <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                    <div 
                      key={day} 
                      className={`p-3 text-center text-sm font-medium ${
                        index === 0 ? 'text-red-600 dark:text-red-400' : 
                        index === 6 ? 'text-blue-600 dark:text-blue-400' : 
                        'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* カレンダー日付 */}
                <div className="grid grid-cols-7">
                  {getCalendarDays(currentDate).map((date, index) => {
                    const todosForDate = getTodosForDate(date)
                    const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                    const isToday = date.toDateString() === new Date().toDateString()
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6
                    
                    return (
                      <div
                        key={index}
                        className={`min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 ${
                          !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                        } ${
                          isToday ? 'ring-2 ring-purple-500 ring-inset' : ''
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' :
                          isToday ? 'text-purple-600 dark:text-purple-400' :
                          isWeekend ? 'text-red-600 dark:text-red-400' :
                          'text-gray-900 dark:text-gray-100'
                        }`}>
                          {date.getDate()}
                        </div>
                        
                        {/* その日のTodo */}
                        <div className="space-y-1">
                          {todosForDate.slice(0, 3).map((todo) => (
                            <div
                              key={todo.id}
                              className={`text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-shadow ${
                                isCompleted(todo.status)
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 line-through opacity-75'
                                  : todo.priority === 'URGENT'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                                  : todo.priority === 'HIGH'
                                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              }`}
                              onClick={() => setEditingTodo(todo)}
                              title={todo.description || todo.title}
                            >
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUpdateTodo(todo.id, { status: getNextStatus(todo.status) })
                                  }}
                                  className={`w-3 h-3 border rounded-sm flex items-center justify-center ${
                                    isCompleted(todo.status) 
                                      ? 'bg-green-500 border-green-500' 
                                      : 'border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isCompleted(todo.status) && (
                                    <div className="w-1 h-1 bg-white rounded-full"></div>
                                  )}
                                </button>
                                <span className="truncate flex-1">
                                  {todo.title}
                                </span>
                              </div>
                            </div>
                          ))}
                          {todosForDate.length > 3 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                              +{todosForDate.length - 3}件
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {activeView === 'kanban' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  🗂️ ワークフローかんばん
                </h3>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {draggedTodo ? (
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      🎯 タスクをドラッグ中... ドロップ先を選んでください
                    </span>
                  ) : (
                    'タスクをドラッグ&ドロップでワークフロー管理'
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 進捗段階別かんばん */}
                {[
                  { status: 'TODO' as Status, label: '📝 未着手', color: 'gray' },
                  { status: 'IN_PROGRESS' as Status, label: '🔄 作業中', color: 'blue' },
                  { status: 'REVIEW' as Status, label: '👀 確認中', color: 'orange' },
                  { status: 'DONE' as Status, label: '✅ 完了', color: 'green' },
                ].map(({ status, label, color }) => {
                  const columnTodos = filteredTodos.filter(t => t.status === status)
                  const totalPoints = columnTodos.reduce((sum, todo) => sum + (todo.priority === 'URGENT' ? 4 : todo.priority === 'HIGH' ? 3 : todo.priority === 'MEDIUM' ? 2 : 1), 0)
                  
                  return (
                    <div 
                      key={status} 
                      className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg p-3 min-h-[500px] border-2 transition-colors ${
                        dragOverColumn === status 
                          ? `border-${color}-400 bg-${color}-100 dark:bg-${color}-900/40 shadow-lg` 
                          : `border-${color}-200 dark:border-${color}-700`
                      }`}
                      data-drop-zone="true"
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDragOver(e, status)
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault()
                        e.stopPropagation() 
                        handleDragLeave(e)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDrop(e, status)
                      }}
                    >
                      <div className="sticky top-0 bg-inherit z-10 pb-3 mb-3 border-b border-current border-opacity-20">
                        <h4 className={`font-semibold text-${color}-800 dark:text-${color}-200 flex items-center justify-between`}>
                          <span className="flex items-center gap-2">
                            {label}
                            <div className="w-6 h-6 bg-current bg-opacity-20 rounded-full flex items-center justify-center text-xs font-bold">
                              {columnTodos.length}
                            </div>
                          </span>
                          <div className="text-xs opacity-75">
                            {totalPoints}pt
                          </div>
                        </h4>
                        <div className="text-xs opacity-70 mt-1">
                          {status === 'TODO' && 'バックログ・計画段階'}
                          {status === 'IN_PROGRESS' && '実作業・開発中'}
                          {status === 'REVIEW' && 'レビュー・確認待ち'}
                          {status === 'DONE' && 'リリース準備完了'}
                        </div>
                      </div>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {columnTodos
                          .sort((a, b) => {
                            // 優先度とdue dateでソート
                            const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
                            if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
                              return priorityWeight[b.priority] - priorityWeight[a.priority]
                            }
                            if (a.dueDate && b.dueDate) {
                              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                            }
                            return 0
                          })
                          .map(todo => {
                            const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && status !== 'DONE'
                            const priorityColor = todo.priority === 'URGENT' ? 'red' : todo.priority === 'HIGH' ? 'orange' : todo.priority === 'MEDIUM' ? 'yellow' : 'green'
                            
                            return (
                              <div 
                                key={todo.id} 
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation()
                                  handleDragStart(e, todo)
                                }}
                                onDragEnd={(e) => {
                                  e.stopPropagation()
                                  handleDragEnd(e)
                                }}
                                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-4 hover:shadow-md transition-all group cursor-grab active:cursor-grabbing select-none ${
                                  isOverdue ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10' :
                                  `border-l-${priorityColor}-400`
                                } ${status === 'DONE' ? 'opacity-75' : ''} ${
                                  draggedTodo?.id === todo.id ? 'opacity-50 scale-95' : ''
                                }`}
                              >
                                {/* ヘッダー: タイトル + アクション */}
                                <div className="flex items-start justify-between mb-3">
                                  <div 
                                    className={`font-medium text-sm cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 flex-1 ${
                                      status === 'DONE' ? 'line-through' : ''
                                    }`}
                                    onClick={() => setEditingTodo(todo)}
                                  >
                                    {todo.title}
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleUpdateTodo(todo.id, { status: getNextStatus(todo.status) })}
                                      className="text-xs p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                      title="次の段階に移動"
                                    >
                                      {status !== 'DONE' ? '→' : '↻'}
                                    </button>
                                    <button
                                      onClick={() => setEditingTodo(todo)}
                                      className="text-xs p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                      title="編集"
                                    >
                                      ✏️
                                    </button>
                                  </div>
                                </div>
                                
                                {/* 説明 */}
                                {todo.description && (
                                  <div className={`text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 ${
                                    status === 'DONE' ? 'line-through' : ''
                                  }`}>
                                    {todo.description}
                                  </div>
                                )}
                                
                                {/* メタデータ */}
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                      todo.priority === 'URGENT' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                                      todo.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                                      todo.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                    }`}>
                                      {todo.priority === 'URGENT' ? '🔥' : todo.priority === 'HIGH' ? '⚡' : todo.priority === 'MEDIUM' ? '⭐' : '📝'} {PRIORITY_LABELS[todo.priority]}
                                    </span>
                                    {/* サブタスクロールアップ（親タスクのみ） */}
                                    {!todo.parentId && (todo.rollup?.total ?? 0) > 0 && (
                                      <button
                                        type="button"
                                        className="text-[11px] text-gray-600 dark:text-gray-300 flex items-center gap-1 hover:underline"
                                        title="サブタスクの進捗（クリックで編集）"
                                        onClick={() => setEditingTodo(todo)}
                                      >
                                        📋 {todo.rollup?.done ?? 0}/{todo.rollup?.total ?? 0}
                                        <span className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden inline-flex">
                                          <span
                                            className="bg-green-500 h-1"
                                            style={{ width: `${Math.min(100, Math.max(0, todo.rollup?.percent ?? 0))}%` }}
                                          />
                                        </span>
                                        <span className="ml-1">({Math.round(Math.min(100, Math.max(0, todo.rollup?.percent ?? 0)))}%)</span>
                                      </button>
                                    )}

                                    {todo.category && (
                                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 rounded-full">
                                        📂 {todo.category}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* 期限 */}
                                  {todo.dueDate && (
                                    <div className={`text-xs flex items-center gap-1 ${
                                      isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                      {isOverdue ? '🚨' : '📅'} 
                                      {format(todo.dueDate, 'M/d HH:mm', { locale: ja })}
                                      {isOverdue && ' (期限切れ)'}
                                    </div>
                                  )}
                                  
                                  {/* タグ */}
                                  {todo.tags && todo.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {todo.tags.slice(0, 3).map((tag) => (
                                        <span 
                                          key={tag} 
                                          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 rounded"
                                        >
                                          #{tag}
                                        </span>
                                      ))}
                                      {todo.tags.length > 3 && (
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          +{todo.tags.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* フッター情報 */}
                                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <span>更新: {format(todo.updatedAt, 'M/d', { locale: ja })}</span>
                                    <span className="font-mono">#{String(todo.id).slice(-6)}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        }
                        
                        {/* 空のカラムの場合のドロップゾーン */}
                        {columnTodos.length === 0 && (
                          <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                            dragOverColumn === status 
                              ? `border-${color}-400 bg-${color}-100 dark:bg-${color}-900/40` 
                              : `border-${color}-300 dark:border-${color}-600`
                          }`}>
                            <div className={`text-${color}-400 dark:text-${color}-500 text-sm`}>
                              {draggedTodo ? (
                                <>
                                  <div className="text-lg mb-2">⬇️</div>
                                  <div>ここにドロップ</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-lg mb-2">📝</div>
                                  <div>まだタスクがありません</div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TodoフォームとTodoリスト */}
      {editingTodo ? (
        (() => {
          const init = {
            title: editingTodo.title,
            description: editingTodo.description || '',
            priority: editingTodo.priority,
            status: editingTodo.status,
            dueDate: editingTodo.dueDate,
            category: editingTodo.category,
            tags: editingTodo.tags,
          }
          return (
            <TodoForm
              key={editingTodo.id}
              onSubmit={handleEditSubmit}
              isLoading={isSubmitting}
              initialData={init}
              onCancel={() => setEditingTodo(null)}
            />
          )
        })()
      ) : (
        <TodoForm
          onSubmit={handleCreateTodo}
          isLoading={isSubmitting}
          // タイトル入力へショートカットでフォーカスするためのref
          // TodoForm側で最初のinputにforwardRefする対応が無いので、次善策として後段のuseEffectでquerySelector
        />
      )}


      {/* フィルター済みTodoリスト表示（「すべて」タブでのみ表示） */}
      {activeView === 'all' && (
        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {todos.length === 0 ? (
                <div className="space-y-2">
                  <div className="text-4xl">📝</div>
                  <div>まだTodoがありません。最初のTodoを作成してみましょう！</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">🔍</div>
                  <div>検索条件に一致するTodoが見つかりませんでした。</div>
                  <div className="text-sm">フィルター条件を変更してみてください。</div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {todos.length}件中 {filteredTodos.length}件を表示
                </p>
                {/* <button 
                  onClick={() => fetchTodos(true)}
                  className="text-xs px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                >
                  🔄 再読み込み
                </button> */}
              </div>
{(() => {
                const activeTodos = filteredTodos.filter(todo => !isCompleted(todo.status))
                const completedTodos = filteredTodos.filter(todo => isCompleted(todo.status))
                
                return (
                  <>
                    {/* 進行中タスク */}
                    {activeTodos.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <span>進行中のタスク ({activeTodos.length}件)</span>
                        </div>
                        {activeTodos.map((todo) => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onUpdate={handleUpdateTodo}
                            onDelete={handleDeleteTodo}
                            onEdit={setEditingTodo}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedTodos.has(todo.id)}
                            onSelect={handleSelectTodo}
                            onSubtaskChange={handleSubtasksChanged}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* 完了タスク */}
                    {completedTodos.length > 0 && (
                      <div className="space-y-3 mt-6">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>完了したタスク ({completedTodos.length}件)</span>
                          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-4"></div>
                        </div>
                        {completedTodos.map((todo) => (
                          <TodoItem
                            key={todo.id}
                            todo={todo}
                            onUpdate={handleUpdateTodo}
                            onDelete={handleDeleteTodo}
                            onEdit={setEditingTodo}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedTodos.has(todo.id)}
                            onSelect={handleSelectTodo}
                            onSubtaskChange={handleSubtasksChanged}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )
              })()}
            </>
          )}
        </div>
      )}
    </div>
  )
}
