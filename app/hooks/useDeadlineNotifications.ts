'use client'

import { useEffect, useRef, useState } from 'react'
import type { Todo } from '@/types/todo'

export interface DeadlineNotifyOptions {
  // 何分前に通知するか
  minutesBefore?: number
  // ポーリング（チェック）間隔（ミリ秒）
  intervalMs?: number
}

export function useDeadlineNotifications(todos: Todo[], opts: DeadlineNotifyOptions = {}) {
  const { minutesBefore = 15, intervalMs = 60_000 } = opts
  const notifiedRef = useRef<Set<string>>(new Set())
  const [enabled, setEnabled] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // 自動で権限を求めず、初回のみ状態を確認
    setEnabled(Notification.permission === 'granted')
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const check = () => {
      const now = Date.now()
      const threshold = minutesBefore * 60_000
      todos.forEach((t) => {
        if (!t.dueDate) return
        if (t.status === 'DONE') return
        const due = new Date(t.dueDate).getTime()
        const diff = due - now
        if (diff <= threshold && diff > -5 * 60_000) { // 期限直後5分まで許容
          if (!notifiedRef.current.has(t.id)) {
            try {
              new Notification('⏰ 期限が近づいています', {
                body: `${t.title}（${minutesBefore}分以内）`,
                tag: `todo-deadline-${t.id}`,
              })
              notifiedRef.current.add(t.id)
            } catch {
              // ignore
            }
          }
        }
      })
    }

    // 初回即時チェック＋インターバル
    check()
    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [enabled, todos, minutesBefore, intervalMs])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') { setEnabled(true); return true }
    const perm = await Notification.requestPermission()
    const ok = perm === 'granted'
    setEnabled(ok)
    return ok
  }

  return { enabled, requestPermission }
}

