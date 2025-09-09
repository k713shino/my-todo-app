'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type ActiveEntry = {
  running: boolean
  todoId?: string | null
  title?: string | null
  startedAt?: string | null
}

function formatHMS(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${m}:${String(ss).padStart(2, '0')}`
}

export default function RunningTimerBanner() {
  const [active, setActive] = useState<ActiveEntry>({ running: false })
  const [now, setNow] = useState<number>(() => Date.now())

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/active', { cache: 'no-store' })
      if (!res.ok) {
        setActive({ running: false })
        return
      }
      const data = (await res.json()) as ActiveEntry
      setActive(data?.running ? data : { running: false })
    } catch {
      setActive({ running: false })
    }
  }, [])

  useEffect(() => {
    fetchActive()
    const onSync = () => fetchActive()
    if (typeof window !== 'undefined') {
      window.addEventListener('time:runningChanged', onSync)
      window.addEventListener('todo:changed', onSync)
      window.addEventListener('visibilitychange', onSync)
    }
    const poll = setInterval(fetchActive, 60_000)
    return () => {
      clearInterval(poll)
      if (typeof window !== 'undefined') {
        window.removeEventListener('time:runningChanged', onSync)
        window.removeEventListener('todo:changed', onSync)
        window.removeEventListener('visibilitychange', onSync)
      }
    }
  }, [fetchActive])

  // 1秒ごとに進行表示を更新
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsedSec = useMemo(() => {
    if (!active.running || !active.startedAt) return 0
    const started = new Date(active.startedAt).getTime()
    return Math.max(0, Math.floor((now - started) / 1000))
  }, [active.running, active.startedAt, now])

  const focusTodo = useCallback(() => {
    try {
      if (!active?.todoId) return
      const sp = new URLSearchParams(window.location.search)
      sp.set('focus', String(active.todoId))
      const newUrl = window.location.pathname + '?' + sp.toString()
      window.history.replaceState(null, '', newUrl)
      window.dispatchEvent(new Event('popstate'))
    } catch {}
  }, [active?.todoId])

  if (!active.running || !active.todoId) return null

  return (
    <div className="rounded-lg border border-amber-300/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
        <div className="truncate">
          <div className="text-xs text-amber-700 dark:text-amber-300">計測中</div>
          <button onClick={focusTodo} className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline truncate" title={active.title || ''}>
            {active.title || `#${active.todoId}`}
          </button>
        </div>
      </div>
      <div className="text-sm font-mono text-amber-800 dark:text-amber-200 ml-2 flex-shrink-0">
        {formatHMS(elapsedSec)}
      </div>
    </div>
  )
}

