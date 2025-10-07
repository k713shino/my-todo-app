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
import DashboardSideNav from '@/app/components/DashboardSideNav'

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
    // 既定は Asia/Tokyo（ブラウザ推奨も確認）
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (tz === 'Asia/Tokyo') return 'Asia/Tokyo'
    } catch {}
    return 'Asia/Tokyo'
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
        // 週数/週開始/タイムゾーンを指定（例: 12週・月曜開始・Asia/Tokyo 既定）
        const tz = encodeURIComponent(timeZone || 'Asia/Tokyo')
        const res = await fetch(`/api/todos/stats?cache=false&refresh=true&weeks=12&months=6&weekStart=mon&tz=${tz}`)
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
  }, [timeZone])

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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <RunningTimeSync />
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 xl:px-10 pb-28 xl:pb-14 pt-6 xl:pt-10">
        <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[240px,minmax(0,1fr),320px] xl:gap-10">
          <DashboardSideNav
            activeTab={homeTab}
            onTabChange={setHomeTab}
            onOpenSearch={() => {
              setHomeTab('tasks')
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('search:open'))
              }
            }}
            user={session?.user ?? undefined}
          />

          <div className="min-w-0 flex flex-col gap-6 xl:max-w-2xl">
            <DashboardHeader
              onModalSearch={handleModalSearch}
              className="sticky top-2 z-30 shadow-xl shadow-slate-950/40 border border-slate-800/70 bg-slate-900/70 backdrop-blur rounded-3xl"
            />

            <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 backdrop-blur px-4 py-3">
              <nav className="flex items-center gap-4 text-sm font-semibold">
                {[
                  { id: 'tasks' as const, label: 'おすすめ', emoji: '⭐' },
                  { id: 'time' as const, label: 'フォーカス', emoji: '⏱' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHomeTab(tab.id)}
                    className={`relative px-3 py-2 transition-colors duration-150 rounded-full ${
                      homeTab === tab.id
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="mr-2">{tab.emoji}</span>
                    {tab.label}
                    {homeTab === tab.id && (
                      <span className="absolute inset-x-3 -bottom-1 h-1 rounded-full bg-blue-500" />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {homeTab === 'time' ? (
              <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 backdrop-blur px-4 sm:px-6 py-4 shadow-xl shadow-slate-950/40">
                <TimeTrackingDashboard />
              </div>
            ) : (
              <TodoList modalSearchValues={modalSearchValues} advancedSearchParams={advancedParams} />
            )}

            <div className="lg:hidden space-y-4">
              <RightRail
                stats={stats}
                timeSummary={timeSummary}
                timeZone={timeZone}
                setTimeZone={setTimeZone}
                formatHM={formatHM}
              />
            </div>
          </div>

          <aside className="hidden lg:flex flex-col gap-6">
            <RightRail
              stats={stats}
              timeSummary={timeSummary}
              timeZone={timeZone}
              setTimeZone={setTimeZone}
              formatHM={formatHM}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

interface RightRailProps {
  stats: TodoStats | null
  timeSummary: { todaySeconds: number; weekSeconds: number } | null
  timeZone: string
  setTimeZone: (tz: string) => void
  formatHM: (sec: number) => string
}

function RightRail({ stats, timeSummary, timeZone, setTimeZone, formatHM }: RightRailProps) {
  return (
    <>
      <RunningTimerBanner />
      {stats && (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 backdrop-blur shadow-xl shadow-slate-950/40">
          <div className="p-5">
            <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
              📊 今日のハイライト
            </h3>
            <TodoStatsDisplay stats={stats} variant="neutral" showTimestamp={false} />
          </div>
        </div>
      )}
      {Boolean(timeSummary) && (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/60 backdrop-blur shadow-xl shadow-slate-950/40">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">⏱️ 時間サマリ</h3>
              <select
                value={timeZone}
                onChange={(e) => {
                  const value = e.target.value
                  setTimeZone(value)
                  try {
                    localStorage.setItem('time:tz', value)
                    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('time:tz-changed', { detail: value }))
                  } catch {}
                }}
                className="select-base text-xs bg-slate-800 border-slate-700 text-slate-200"
                title="タイムゾーンを選択"
              >
                <option value="UTC">UTC</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 px-4 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">今日</div>
                <div className="text-2xl font-bold text-blue-400">{formatHM(timeSummary?.todaySeconds || 0)}</div>
              </div>
              <div className="rounded-2xl bg-slate-800/80 border border-slate-700/80 px-4 py-3 text-center">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">今週</div>
                <div className="text-2xl font-bold text-purple-400">{formatHM(timeSummary?.weekSeconds || 0)}</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              集中して取り組めた時間を自動で集計します。休憩やスナックタイムも忘れずに！
            </p>
          </div>
        </div>
      )}
      <div className="rounded-3xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-900/80 backdrop-blur shadow-xl shadow-slate-950/40 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-2">📌 ヒント</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          検索モーダルで高度検索を活用すると、タグや正規表現で素早くタスクを絞り込めます。
        </p>
      </div>
    </>
  )
}
