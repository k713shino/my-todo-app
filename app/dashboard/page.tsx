'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import TodoList from '@/app/components/TodoList'
import DashboardHeader from '@/app/components/DashboardHeader'
import TodoStatsDisplay from '@/app/components/TodoStatsDisplay'
import TimeTrackingDashboard from '@/app/components/TimeTrackingDashboard'
import RunningTimeSync from '@/app/components/RunningTimeSync'
import RunningTimerBanner from '@/app/components/RunningTimerBanner'
import type { TodoStats } from '@/types/todo'
import { useMemo } from 'react'

export default function Dashboard() {
  const { data: session, status } = useSession()
  // ホームタブ（時間/タスク）
  const [homeTab, setHomeTab] = useState<'time' | 'tasks'>('tasks')
  
  // タイムゾーン選択（サマリ用）
  const [timeZone, setTimeZone] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('time:tz')
      if (saved) return saved
    } catch {}
    // ブラウザの推奨タイムゾーンがAsia/Tokyoならそれを既定に
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz === 'Asia/Tokyo') return 'Asia/Tokyo'
    } catch {}
    return 'UTC'
  })
  
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
        console.log('🕒 時間サマリ取得開始')
        const res = await fetch(`/api/time-entries/summary${timeZone ? `?tz=${encodeURIComponent(timeZone)}` : ''}`)
        console.log('🕒 時間サマリAPI応答:', res.status, res.statusText)
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error('❌ 時間サマリAPI エラー:', res.status, errorText)
          return
        }
        
        const data = await res.json()
        console.log('✅ 時間サマリデータ:', data)
        if (mounted) setTimeSummary(data)
      } catch (error) {
        console.error('❌ 時間サマリ取得エラー:', error)
      }
    }
    fetchSummary()
    const id = setInterval(fetchSummary, 10 * 1000) // 10秒間隔に短縮してテスト
    const onChanged = () => fetchSummary()
    if (typeof window !== 'undefined') {
      window.addEventListener('todo:changed', onChanged)
    }
    return () => { 
      mounted = false
      clearInterval(id)
      if (typeof window !== 'undefined') window.removeEventListener('todo:changed', onChanged)
    }
  }, [timeZone])

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
      {/* 計測中タスクのサーバ同期（非表示コンポーネント）*/}
      <RunningTimeSync />

      {/* メインコンテンツ - 固定ヘッダー分の上余白 */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ホームタブ切替 */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex gap-2">
              {[
                { id: 'time', label: '⏱ 時間' },
                { id: 'tasks', label: '🧾 タスク' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setHomeTab(t.id as any)}
                  className={`py-2.5 px-4 text-sm font-medium border-b-2 rounded-t-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    homeTab === t.id
                      ? 'border-purple-500 text-purple-600 dark:text-purple-300'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >{t.label}</button>
              ))}
            </nav>
          </div>

          {homeTab === 'time' && (
            <>
              {/* 上段: 左=時間ダッシュボード / 右=要約（統計＋時間サマリ＋詳細分析） */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <TimeTrackingDashboard />
                </div>
                <aside className="space-y-4">
                  {/* 計測中バナー */}
                  <RunningTimerBanner />
                  {stats && (
                    <div className="card">
                      <div className="card-section">
                        <TodoStatsDisplay stats={stats} variant="neutral" showTimestamp={false} />
                      </div>
                    </div>
                  )}
                  {Boolean(timeSummary) && (
                    <div className="card">
                      <div className="card-section">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">⏱️ 時間サマリ</h3>
                          <div className="flex items-center gap-2">
                            <select
                              value={timeZone}
                              onChange={(e) => { setTimeZone(e.target.value); try { localStorage.setItem('time:tz', e.target.value); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('time:tz-changed', { detail: e.target.value })) } catch {} }}
                              className="select-base text-xs"
                              title="タイムゾーンを選択"
                            >
                              <option value="UTC">UTC</option>
                              <option value="Asia/Tokyo">Asia/Tokyo</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center">
                            <div className="text-[11px] muted mb-1">今日</div>
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatHM(timeSummary?.todaySeconds || 0)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[11px] muted mb-1">今週</div>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatHM(timeSummary?.weekSeconds || 0)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}

          {homeTab === 'tasks' && (
            <>
              {/* タスクビュー: 左=ツールバー+一覧 / 右=統計 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <div className="toolbar justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">🧾 Todo</span>
                      <span className="text-xs muted hidden sm:inline">一覧と操作</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 将来: 選択モード/新規作成ボタン */}
                    </div>
                  </div>
                  <TodoList modalSearchValues={modalSearchValues} advancedSearchParams={advancedParams} />
                </div>
                <aside className="space-y-4">
                  {/* 計測中バナー */}
                  <RunningTimerBanner />
                  {stats && (
                    <div className="card">
                      <div className="card-section">
                        <TodoStatsDisplay stats={stats} variant="neutral" showTimestamp={false} />
                      </div>
                    </div>
                  )}
                  {Boolean(timeSummary) && (
                    <div className="card">
                      <div className="card-section">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">⏱️ 時間サマリ</h3>
                          <div className="flex items-center gap-2">
                            <select
                              value={timeZone}
                              onChange={(e) => { setTimeZone(e.target.value); try { localStorage.setItem('time:tz', e.target.value); if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('time:tz-changed', { detail: e.target.value })) } catch {} }}
                              className="select-base text-xs"
                              title="タイムゾーンを選択"
                            >
                              <option value="UTC">UTC</option>
                              <option value="Asia/Tokyo">Asia/Tokyo</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center">
                            <div className="text-[11px] muted mb-1">今日</div>
                            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">{formatHM(timeSummary?.todaySeconds || 0)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[11px] muted mb-1">今週</div>
                            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatHM(timeSummary?.weekSeconds || 0)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
