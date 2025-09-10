'use client'

import { useEffect, useState } from 'react'

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      try {
        const y = window.scrollY || document.documentElement.scrollTop || 0
        setVisible(y > 300)
      } catch {}
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      window.scrollTo(0, 0)
    }
  }

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="ページの先頭へ戻る"
      title="ページの先頭へ戻る"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 safe-bottom z-50 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-purple-600 text-white shadow-lg hover:bg-purple-700 active:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
        <path d="M5 15l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="hidden sm:inline text-sm">トップへ</span>
    </button>
  )
}

