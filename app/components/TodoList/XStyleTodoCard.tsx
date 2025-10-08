'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import type { Todo, CreateTodoData } from '@/types/todo'
import { toast } from 'react-hot-toast'

interface XStyleTodoCardProps {
  todo: Todo
  onUpdate: (id: string, data: CreateTodoData) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onEdit: (todo: Todo) => void
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
}

/**
 * X (Twitter) 風のタスクカード
 * 特徴: ミニマル、ホバーで浮き上がる、クリックエリアが広い
 */
export default function XStyleTodoCard({
  todo,
  onUpdate,
  onDelete,
  onEdit,
  isSelectionMode,
  isSelected,
  onSelect,
}: XStyleTodoCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isTracking, setIsTracking] = useState(false)

  const isCompleted = todo.status === 'DONE'
  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !isCompleted

  const getPriorityColor = () => {
    switch (todo.priority) {
      case 'URGENT': return 'text-red-500'
      case 'HIGH': return 'text-orange-500'
      case 'MEDIUM': return 'text-blue-500'
      case 'LOW': return 'text-gray-500'
    }
  }

  const getStatusIcon = () => {
    switch (todo.status) {
      case 'TODO': return '⚪'
      case 'IN_PROGRESS': return '🔵'
      case 'REVIEW': return '🟡'
      case 'DONE': return '✅'
    }
  }

  useEffect(() => {
    const read = () => {
      try {
        const runId = localStorage.getItem('time:runningTodoId')
        setIsTracking((runId ?? '') === String(todo.id))
      } catch {}
    }
    read()
    const onSync = () => read()
    if (typeof window !== 'undefined') {
      window.addEventListener('time:runningChanged', onSync)
      window.addEventListener('todo:changed', onSync)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('time:runningChanged', onSync)
        window.removeEventListener('todo:changed', onSync)
      }
    }
  }, [todo.id])

  const startTracking = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todoId: todo.id })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try {
        const data = await res.clone().json().catch(() => null)
        if (data && data.startedAt) localStorage.setItem('time:startedAt', String(data.startedAt))
      } catch {}
      try {
        localStorage.setItem('time:runningTodoId', String(todo.id))
        if (todo?.title) localStorage.setItem('time:runningTitle', String(todo.title))
      } catch {}
      setIsTracking(true)
      toast.success('⏱️ 計測を開始しました')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('time:runningChanged'))
        window.dispatchEvent(new CustomEvent('todo:changed'))
      }
    } catch {
      toast.error('計測開始に失敗しました')
    }
  }, [todo.id, todo?.title])

  const stopTracking = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/stop', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try {
        localStorage.removeItem('time:runningTodoId')
        localStorage.removeItem('time:startedAt')
        localStorage.removeItem('time:runningTitle')
      } catch {}
      setIsTracking(false)
      toast('⏹️ 計測を停止しました')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('time:runningChanged'))
        window.dispatchEvent(new CustomEvent('todo:changed'))
      }
    } catch {
      toast.error('計測停止に失敗しました')
    }
  }, [])

  const baseCardClasses = 'group relative mb-3 rounded-2xl border px-5 py-4 shadow-sm transition-all duration-200 cursor-pointer first:mt-4 last:mb-0'
  const surfaceClasses = isSelected
    ? 'border-blue-400 bg-blue-50/80 shadow-md ring-1 ring-blue-200/60 dark:border-blue-500 dark:bg-blue-900/25 dark:ring-blue-700/40'
    : isHovered
      ? 'border-slate-200 bg-slate-50/80 shadow-md dark:border-gray-700 dark:bg-gray-800/60'
      : 'border-slate-200/80 bg-white/95 dark:border-gray-800/70 dark:bg-gray-900/80'

  return (
    <article
      className={`${baseCardClasses} ${surfaceClasses}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(todo)}
      data-todo-id={todo.id}
    >
      <div className="flex gap-3">
        {/* 選択チェックボックス or ステータスアイコン */}
        <div className="flex-shrink-0 pt-0.5">
          {isSelectionMode ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onSelect?.(todo.id)
              }}
              className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-500 transition-colors"
            >
              {isSelected && (
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const nextStatus: Status = isCompleted ? 'TODO' : 'DONE'
                onUpdate(todo.id, {
                  title: todo.title,
                  status: nextStatus
                })
              }}
              className="text-xl hover:scale-110 transition-transform"
              title={isCompleted ? '未完了に戻す' : '完了にする'}
            >
              {getStatusIcon()}
            </button>
          )}
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 min-w-0">
          {/* タイトル */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`text-[15px] font-normal text-gray-900 dark:text-white leading-tight ${
              isCompleted ? 'line-through opacity-60' : ''
            }`}>
              {todo.title}
            </h3>

            <div className="flex items-center gap-2">
              <span className={`flex-shrink-0 text-xs font-medium ${getPriorityColor()}`}>
                {todo.priority === 'URGENT' && '🔥'}
                {todo.priority === 'HIGH' && '⚡'}
                {todo.priority === 'MEDIUM' && '✨'}
                {todo.priority === 'LOW' && '💎'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (isTracking) {
                    stopTracking()
                  } else {
                    startTracking()
                  }
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm transition-colors ${
                  isTracking
                    ? 'bg-rose-100 text-rose-600 ring-1 ring-rose-200/70 dark:bg-red-900/30 dark:text-red-300 animate-pulse'
                    : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60 hover:bg-emerald-100 dark:bg-green-900/30 dark:text-green-300'
                }`}
                title={isTracking ? '計測を停止' : '計測を開始'}
              >
                {isTracking ? '⏹ 計測中' : '▶️ 計測'}
              </button>
            </div>
          </div>

          {/* 説明 */}
          {todo.description && (
            <p className="text-[13px] text-slate-600 dark:text-gray-400 mb-3 leading-relaxed line-clamp-2">
              {todo.description}
            </p>
          )}

          {/* メタ情報 */}
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-500 dark:text-gray-500">
            {/* 期限 */}
            {todo.dueDate && (
              <span className={`flex items-center gap-1 ${
                isOverdue ? 'text-red-500 font-medium' : ''
              }`}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {format(todo.dueDate, 'M/d HH:mm', { locale: ja })}
              </span>
            )}

            {/* カテゴリ */}
            {todo.category && (
              <span className="px-3 py-0.5 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700/50">
                {todo.category}
              </span>
            )}

            {/* タグ */}
            {todo.tags && todo.tags.length > 0 && (
              <div className="flex gap-1">
                {todo.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-sky-600 dark:text-blue-300">
                    #{tag}
                  </span>
                ))}
                {todo.tags.length > 2 && (
                  <span className="text-slate-400 dark:text-gray-500">+{todo.tags.length - 2}</span>
                )}
              </div>
            )}

          </div>

          {/* ステータスタブ */}
          <div className="mt-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="進捗ステータス">
              {(Object.entries({
                TODO: '未着手',
                IN_PROGRESS: '作業中',
                REVIEW: '確認中',
                DONE: '完了',
              }) as [Status, string][]).map(([status, label]) => {
                const isActive = todo.status === status
                return (
                  <button
                    key={status}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!isActive) onUpdate(todo.id, { title: todo.title, status })
                    }}
                    className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all border ${
                      isActive
                        ? 'border-blue-500 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200/60 dark:from-blue-600 dark:to-indigo-600'
                        : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-blue-300 hover:bg-blue-50/80 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ホバー時のアクションボタン */}
        <div className={`flex-shrink-0 flex items-center gap-1 transition-all ${
          isHovered ? 'opacity-100 translate-x-0' : 'pointer-events-none translate-x-2 opacity-0'
        }`}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit(todo)
            }}
            className="p-2 rounded-full text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-500 dark:text-gray-400 dark:hover:bg-blue-900/20"
            title="編集"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('このタスクを削除しますか？')) {
                onDelete(todo.id)
              }
            }}
            className="p-2 rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:text-gray-400 dark:hover:bg-red-900/20"
            title="削除"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}
