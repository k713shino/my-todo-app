'use client'

import { useEffect } from 'react'

export default function RunningTimeSync() {
  useEffect(() => {
    let cancelled = false
    const sync = async () => {
      try {
        const res = await fetch('/api/time-entries/active')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const prev = typeof window !== 'undefined' ? localStorage.getItem('time:runningTodoId') : null
        if (data?.running && data.todoId) {
          try { localStorage.setItem('time:runningTodoId', String(data.todoId)) } catch {}
          if (prev !== String(data.todoId)) {
            try { window.dispatchEvent(new Event('time:runningChanged')) } catch {}
          }
        } else {
          // サーバ側で未検出でも直後の開始直後のレースを考慮し、ローカルにrunIdがある場合は維持
          if (!prev) {
            try { localStorage.removeItem('time:runningTodoId') } catch {}
            try { window.dispatchEvent(new Event('time:runningChanged')) } catch {}
          }
        }
      } catch {}
    }

    // 初回/フォーカス復帰/変更イベントで同期
    sync()
    const onVisible = () => { if (!document.hidden) sync() }
    // todo:changed直後はLambdaが確定するまで少し待ってから同期（レース回避）
    const onTodoChanged = () => { setTimeout(sync, 1000) }
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', onVisible)
      window.addEventListener('todo:changed', onTodoChanged)
    }
    // 定期同期（60秒）
    const id = setInterval(sync, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
      if (typeof window !== 'undefined') {
        window.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('todo:changed', onTodoChanged)
      }
    }
  }, [])
  return null
}
