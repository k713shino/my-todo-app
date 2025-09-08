'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import TodoList from '@/app/components/TodoList'
import DashboardHeader from '@/app/components/DashboardHeader'
import TodoStatsDisplay from '@/app/components/TodoStatsDisplay'
import type { TodoStats } from '@/types/todo'
import { useMemo } from 'react'

export default function Dashboard() {
  const { data: session, status } = useSession()
  
  // モーダルからの検索値を管理する状態
  const [modalSearchValues, setModalSearchValues] = useState({
    keyword: '',
    category: '',
    tags: [] as string[],
    completed: undefined as boolean | undefined,
    priority: undefined as string | undefined,
    dateRange: undefined as string | undefined
  })
  const [advancedParams, setAdvancedParams] = useState<Record<string, string> | undefined>(undefined)

  // ダッシュボード統計の取得（最小）
  const [stats, setStats] = useState<TodoStats | null>(null)
  const [timeSummary, setTimeSummary] = useState<{ todaySeconds: number; weekSeconds: number } | null>(null)
  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      try {
        // 週数/週開始/タイムゾーンを指定（例: 12週・月曜開始・UTC）
        const res = await fetch('/api/todos/stats?cache=false&refresh=true&weeks=12&months=6&weekStart=mon&tz=UTC')
        if (!res.ok) return
        const data = await res.json()
        // サーバがunavailableを示した場合は表示しない
        if (mounted && !data.unavailable) setStats(data)
      } catch {}
    }
    fetchStats()
    // 5分に1回リフレッシュ
    const id = setInterval(fetchStats, 5 * 60 * 1000)
    // Todo変更イベントで即時リフレッシュ
    const onChanged = () => fetchStats()
    if (typeof window !== 'undefined') {
      window.addEventListener('todo:changed', onChanged)
    }
    return () => { mounted = false; clearInterval(id); if (typeof window !== 'undefined') window.removeEventListener('todo:changed', onChanged) }
  }, [])

  // 時間サマリの取得（MVP）
  useEffect(() => {
    let mounted = true
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/time-entries/summary')
        if (!res.ok) return
        const data = await res.json()
        if (mounted) setTimeSummary(data)
      } catch {}
    }
    fetchSummary()
    const id = setInterval(fetchSummary, 30 * 1000) // 30秒間隔に変更
    const onChanged = () => fetchSummary()
    if (typeof window !== 'undefined') {
      window.addEventListener('todo:changed', onChanged)
    }
    return () => { 
      mounted = false
      clearInterval(id)
      if (typeof window !== 'undefined') window.removeEventListener('todo:changed', onChanged)
    }
  }, [])

  const formatHM = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    if (h <= 0) return `${m}分`
    if (m <= 0) return `${h}時間`
    return `${h}時間${m}分`
  }

  // 認証チェック
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session?.user) {
    redirect('/auth/signin')
  }

  // ヘッダーモーダルからの検索処理
  const handleModalSearch = (filters: {
    keyword: string
    category: string
    tags: string[]
    completed?: boolean
    priority?: string
    dateRange?: string
  }, advanced?: Record<string, string>) => {
    console.log('🔍 ヘッダーモーダルからの検索:', filters)
    
    // 検索値を更新してTodoListに反映
    setModalSearchValues({
      keyword: filters.keyword,
      category: filters.category,
      tags: filters.tags,
      completed: filters.completed,
      priority: filters.priority,
      dateRange: filters.dateRange
    })
    setAdvancedParams(advanced)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* ヘッダー */}
      <DashboardHeader onModalSearch={handleModalSearch} />

      {/* メインコンテンツ - 固定ヘッダー分の上余白を追加（1カラム） */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24">
        <div className="max-w-7xl mx-auto">
          {/* 統計カード（コンパクト常時表示＋詳細は折りたたみ） */}
          {stats && (
            <div className="mb-6 max-w-4xl mx-auto space-y-4">
              {/* コンパクト統計 */}
              <TodoStatsDisplay stats={stats} variant="compact" showTimestamp={false} />
              {/* 時間サマリ（MVP） */}
              {timeSummary && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      ⏱️ 時間追跡サマリ
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">今日</div>
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {formatHM(timeSummary.todaySeconds)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {timeSummary.todaySeconds > 0 && `${Math.floor(timeSummary.todaySeconds / 60)}分`}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">今週</div>
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatHM(timeSummary.weekSeconds)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {timeSummary.weekSeconds > 0 && `${Math.floor(timeSummary.weekSeconds / 60)}分`}
                      </div>
                    </div>
                  </div>
                  {(timeSummary.todaySeconds > 0 || timeSummary.weekSeconds > 0) && (
                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                      <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        週平均: {formatHM(Math.floor(timeSummary.weekSeconds / 7))} / 日
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* 詳細分析（折りたたみ） */}
              <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm text-gray-700 dark:text-gray-300 flex items-center justify-between">
                  <span>📈 詳細分析</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">開閉</span>
                </summary>
                <div className="p-3">
                  <TodoStatsDisplay stats={stats} variant="neutral" showTimestamp={false} />
                </div>
              </details>
            </div>
          )}

          {/* Todoリスト */}
          <TodoList modalSearchValues={modalSearchValues} advancedSearchParams={advancedParams} />
        </div>
      </main>
    </div>
  )
}
