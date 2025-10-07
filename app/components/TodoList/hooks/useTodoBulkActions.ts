'use client'

import { useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { Status } from '@prisma/client'
import type { Todo } from '@/types/todo'
import { getErrorMessage, logApiError, type ErrorWithStatus } from '@/lib/error-utils'

interface UseTodoBulkActionsProps {
  todos: Todo[]
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>
  fetchTodos: (bypassCache?: boolean) => Promise<void>
}

/**
 * Todo一括操作を管理するカスタムフック
 */
export function useTodoBulkActions({ todos, setTodos, fetchTodos }: UseTodoBulkActionsProps) {
  const [selectedTodos, setSelectedTodos] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isBulkOperating, setIsBulkOperating] = useState(false)

  /**
   * 過負荷防止のため、同時実行数を制限する軽量ワーカー
   */
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

  /**
   * 全選択・全解除
   */
  const handleSelectAll = useCallback((filteredTodos: Todo[]) => {
    if (selectedTodos.size === filteredTodos.length) {
      setSelectedTodos(new Set())
    } else {
      setSelectedTodos(new Set(filteredTodos.map(todo => todo.id)))
    }
  }, [selectedTodos.size])

  /**
   * 個別選択・解除
   */
  const handleSelectTodo = useCallback((todoId: string) => {
    const newSelected = new Set(selectedTodos)
    if (newSelected.has(todoId)) {
      newSelected.delete(todoId)
    } else {
      newSelected.add(todoId)
    }
    setSelectedTodos(newSelected)
  }, [selectedTodos])

  /**
   * 選択モード切り替え
   */
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(!isSelectionMode)
    if (isSelectionMode) {
      setSelectedTodos(new Set())
    }
  }, [isSelectionMode])

  /**
   * バルクステータス更新
   */
  const handleBulkStatusUpdate = useCallback(async (targetStatus: Status) => {
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
        await new Promise(resolve => setTimeout(resolve, 200))
        await fetchTodos(true)

        await new Promise(resolve => setTimeout(resolve, 100))
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      } catch (error) {
        console.log('⚠️ キャッシュクリアまたはデータ再取得失敗:', error)
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      }

    } catch (error) {
      setTodos(originalTodos)

      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'バルクステータス更新')

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`バルク更新エラー: ${friendlyMessage}`)
    } finally {
      setIsBulkOperating(false)
    }
  }, [selectedTodos, todos, setTodos, fetchTodos])

  /**
   * バルク削除
   */
  const handleBulkDelete = useCallback(async () => {
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

      if (okCount > 0) {
        const successfulIds = failCount === 0 ? selectedIds : selectedIds.slice(0, okCount)

        setTodos(prev => prev.filter(todo => !successfulIds.includes(todo.id)))

        if (failCount === 0) {
          toast.success(`🗑️ ${okCount}件のTodoを削除しました`)
        } else {
          toast.success(`⚠️ ${okCount}件削除成功（${failCount}件は失敗）`)
        }
      } else {
        toast.error('❌ 一括削除に失敗しました')
        return
      }

      setSelectedTodos(new Set())

      try {
        await fetch('/api/cache?type=user', { method: 'DELETE' })
        await new Promise(resolve => setTimeout(resolve, 200))
        await fetchTodos(true)

        await new Promise(resolve => setTimeout(resolve, 100))
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      } catch (error) {
        console.log('⚠️ キャッシュクリアまたはデータ再取得失敗:', error)
        try { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('todo:changed')) } catch {}
      }

    } catch (error) {
      setTodos(originalTodos)

      const errorWithStatus = error as ErrorWithStatus
      logApiError(errorWithStatus, 'バルク削除')

      const friendlyMessage = getErrorMessage(errorWithStatus)
      toast.error(`バルク削除エラー: ${friendlyMessage}`)
    } finally {
      setIsBulkOperating(false)
    }
  }, [selectedTodos, todos, setTodos, fetchTodos])

  return {
    selectedTodos,
    setSelectedTodos,
    isSelectionMode,
    setIsSelectionMode,
    isBulkOperating,
    handleSelectAll,
    handleSelectTodo,
    toggleSelectionMode,
    handleBulkStatusUpdate,
    handleBulkDelete,
    runWithConcurrency,
  }
}
