'use client'

import { ReactNode, type CSSProperties } from 'react'

interface XStyleContainerProps {
  children: ReactNode
}

/**
 * X (Twitter) スタイルのコンテナ
 * 特徴: クリーンな白背景、シャープなボーダー、控えめな影
 */
export default function XStyleContainer({ children }: XStyleContainerProps) {
  const surfaceStyle: CSSProperties & Record<'--x-tabs-offset', string> = {
    '--x-tabs-offset': 'calc(24px + 56px)',
  }

  return (
    <div className="relative min-h-screen">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-slate-100 via-white to-slate-50 transition-colors dark:from-gray-950 dark:via-gray-900 dark:to-gray-950"
      />

      <div className="max-w-3xl mx-auto px-4 pb-16">
        {/* ヘッダー: X風の固定ヘッダー */}
        <div className="sticky top-0 z-30 -mx-4 px-4 pt-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_rgba(148,163,184,0.18)] backdrop-blur-md supports-[backdrop-filter]:bg-white/75 transition-colors dark:border-gray-800/70 dark:bg-gray-900/80">
            <div className="px-6 py-3">
              <h1 className="text-xl font-semibold text-slate-900 transition-colors dark:text-white">
                タスク
              </h1>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div
          className="mt-8 rounded-3xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/60 transition-colors dark:border-gray-800 dark:bg-gray-900/95"
          style={surfaceStyle}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
