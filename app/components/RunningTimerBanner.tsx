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
  const [runIdLocal, setRunIdLocal] = useState<string | null>(() => {
    try { return localStorage.getItem('time:runningTodoId') } catch { return null }
  })
  const [derivedTitle, setDerivedTitle] = useState<string | null>(null)
  const [startedAtLocal, setStartedAtLocal] = useState<string | null>(() => {
    try { return localStorage.getItem('time:startedAt') } catch { return null }
  })
  const [titleLocal, setTitleLocal] = useState<string | null>(() => {
    try { return localStorage.getItem('time:runningTitle') } catch { return null }
  })

  const fetchActive = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/active', { cache: 'no-store' })
      if (!res.ok) {
        setActive({ running: false })
        return
      }
      const data = (await res.json()) as ActiveEntry
      setActive(data?.running ? data : { running: false })
      // ローカルにも反映（タイトル/開始時刻）
      if (data?.running) {
        try {
          if (data.startedAt) localStorage.setItem('time:startedAt', String(data.startedAt))
          if (data.title) localStorage.setItem('time:runningTitle', String(data.title))
        } catch {}
      }
    } catch {
      setActive({ running: false })
    }
  }, [])

  useEffect(() => {
    fetchActive()
    const onSync = () => {
      try {
        setRunIdLocal(localStorage.getItem('time:runningTodoId'))
        setStartedAtLocal(localStorage.getItem('time:startedAt'))
        setTitleLocal(localStorage.getItem('time:runningTitle'))
      } catch {}
      fetchActive()
    }
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
    const startedIso = active?.startedAt || startedAtLocal
    if (!startedIso) return 0
    const started = new Date(startedIso).getTime()
    return Math.max(0, Math.floor((now - started) / 1000))
  }, [active?.startedAt, startedAtLocal, now])

  // タイトルのフォールバック解決（サーバーが未返却の時はDOMから推測）
  useEffect(() => {
    let cancelled = false
    let attempts = 0
    const maxAttempts = 30
    const interval = 150
    const id = active?.todoId || runIdLocal
    const tryResolve = () => {
      if (cancelled) return
      if (active?.title) { setDerivedTitle(active.title); return }
      if (titleLocal) { setDerivedTitle(titleLocal); return }
      if (!id) { setDerivedTitle(null); return }
      try {
        const el = document.querySelector(`#todo-${CSS.escape(String(id))} h3`)
        if (el) {
          setDerivedTitle((el as HTMLElement).innerText.trim())
          return
        }
      } catch {}
      attempts++
      if (attempts < maxAttempts) {
        setTimeout(tryResolve, interval)
      } else {
        setDerivedTitle(null)
      }
    }
    tryResolve()
    return () => { cancelled = true }
  }, [active?.title, active?.todoId, runIdLocal, titleLocal])

  const focusTodo = useCallback(() => {
    try {
      const id = active?.todoId || runIdLocal
      if (!id) return
      const sp = new URLSearchParams(window.location.search)
      sp.set('focus', String(id))
      const newUrl = window.location.pathname + '?' + sp.toString()
      window.history.replaceState(null, '', newUrl)
      window.dispatchEvent(new Event('popstate'))
    } catch {}
  }, [active?.todoId, runIdLocal])

  const stopNow = useCallback(async () => {
    try {
      const res = await fetch('/api/time-entries/stop', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      try { localStorage.removeItem('time:runningTodoId') } catch {}
      try { localStorage.removeItem('time:startedAt'); localStorage.removeItem('time:runningTitle') } catch {}
      try { 
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('time:runningChanged'))
          window.dispatchEvent(new Event('todo:changed'))
        }
      } catch {}
      // 即時反映
      setActive({ running: false })
    } catch {}
  }, [])

  const displayRunning = active.running || !!runIdLocal
  const displayTodoId = active.todoId || runIdLocal
  if (!displayRunning || !displayTodoId) return null

  return (
    <div className="rounded-lg border border-amber-300/70 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
        <div className="truncate">
          <div className="text-xs text-amber-700 dark:text-amber-300">計測中</div>
          <button onClick={focusTodo} className="text-sm font-medium text-amber-800 dark:text-amber-200 hover:underline truncate" title={derivedTitle || ''}>
            {derivedTitle || `#${displayTodoId}`}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2 flex-shrink-0">
        {active.startedAt || startedAtLocal ? (
          <div className="text-sm font-mono text-amber-800 dark:text-amber-200">
            {formatHMS(elapsedSec)}
          </div>
        ) : (
          <div className="text-sm font-mono text-amber-800 dark:text-amber-200">--:--</div>
        )}
        <button onClick={stopNow} className="px-2 py-1 text-xs rounded-md bg-red-600 text-white hover:bg-red-700">
          停止
        </button>
      </div>
    </div>
  )
}
