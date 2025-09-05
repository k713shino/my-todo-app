'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
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
  const USER_PREF_KEY = 'notify:deadline:enabled'

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return

    // ユーザー設定と権限の両方が有効な場合のみ有効化
    const loadPref = () => {
      try { return localStorage.getItem(USER_PREF_KEY) } catch { return null }
    }
    const initialPref = loadPref()
    const userEnabled = initialPref === null ? true : initialPref === 'true'
    setEnabled(Notification.permission === 'granted' && userEnabled)

    const onStorage = (e: StorageEvent) => {
      if (e.key === USER_PREF_KEY) {
        const userEnabled = e.newValue === null ? true : e.newValue === 'true'
        setEnabled(Notification.permission === 'granted' && userEnabled)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    const check = async () => {
      const now = Date.now()
      const threshold = minutesBefore * 60_000
      for (const t of todos) {
        if (!t.dueDate) return
        if (t.status === 'DONE') return
        const due = new Date(t.dueDate).getTime()
        const diff = due - now
        if (diff <= threshold && diff > -5 * 60_000) { // 期限直後5分まで許容
          if (!notifiedRef.current.has(t.id)) {
            try {
              if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready
                await reg.showNotification('⏰ 期限が近づいています', {
                  body: `${t.title}（${minutesBefore}分以内）`,
                  tag: `todo-deadline-${t.id}`,
                  data: { todoId: t.id },
                  requireInteraction: false,
                })
              } else {
                const n = new Notification('⏰ 期限が近づいています', {
                  body: `${t.title}（${minutesBefore}分以内）`,
                  tag: `todo-deadline-${t.id}`,
                  data: { todoId: t.id }
                } as NotificationOptions)
                n.onclick = () => {
                  try {
                    window.focus()
                    const target = `/dashboard?focus=${encodeURIComponent(t.id)}`
                    if (document.visibilityState === 'visible') {
                      window.location.assign(target)
                    } else {
                      window.open(target, '_blank', 'noopener,noreferrer')
                    }
                    n.close()
                  } catch {}
                }
              }
            } catch { /* ignore */ }
            // トーストでも通知（権限なし/視認性向上）
            try {
              const mins = Math.max(0, Math.round(diff / 60000))
              toast(`⏰ 期限が近づいています: ${t.title}（あと${mins}分）`)
            } catch {}
            notifiedRef.current.add(t.id)
          }
        }
      }
    }

    // 初回即時チェック＋インターバル
    check().catch(() => {})
    const id = setInterval(() => { check().catch(() => {}) }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, todos, minutesBefore, intervalMs])

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return false
    if (Notification.permission === 'granted') { setEnabled(true); return true }
    const perm = await Notification.requestPermission()
    const ok = perm === 'granted'
    try {
      const pref = localStorage.getItem(USER_PREF_KEY)
      const userEnabled = pref === null ? true : pref === 'true'
      setEnabled(ok && userEnabled)
    } catch {
      setEnabled(ok)
    }
    return ok
  }

  return { enabled, requestPermission }
}
