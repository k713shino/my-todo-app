'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import TimeGoalSetting from './TimeGoalSetting'

interface TaskStats {
  taskId: string
  taskTitle: string
  taskStatus: string
  taskCategory: string
  totalSeconds: number
  sessions: number
  avgSessionTime: number
  efficiency: number
}

interface HourlyStats {
  hour: number
  seconds: number
}

interface TimeAnalytics {
  totalSeconds: number
  dailyStats: Array<{ date: string; seconds: number }>
  taskStats: TaskStats[]
  weeklyAverage: number
  productivity: {
    bestDay: string
    worstDay: string
    consistency: number
  }
}

interface TaskTimeStats {
  taskStats: TaskStats[]
  totalTasks: number
  workedTasks: number
  totalWorkTime: number
  totalSessions: number
  hourlyProductivity: HourlyStats[]
  mostProductiveHour: { hour: number; seconds: number }
}

export default function TimeTrackingDashboard() {
  const { data: session } = useSession()
  const [analytics, setAnalytics] = useState<TimeAnalytics | null>(null)
  const [taskStats, setTaskStats] = useState<TaskTimeStats | null>(null)
  const [summary, setSummary] = useState<{ todaySeconds: number; weekSeconds: number } | null>(null)
  const [runningTodoId, setRunningTodoId] = useState<string | null>(null)
  const [timeZone, setTimeZone] = useState<string>(() => {
    try {
      return localStorage.getItem('time:tz') || 'UTC'
    } catch {
      return 'UTC'
    }
  })
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'productivity' | 'goals'>('overview')
  const [tasksSort, setTasksSort] = useState<'totalTime' | 'sessions' | 'efficiency'>('totalTime')
  const [loading, setLoading] = useState(true)

  // データ取得
  useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const tzQ = timeZone ? `&tz=${encodeURIComponent(timeZone)}` : ''
        const tzQ2 = timeZone ? `?tz=${encodeURIComponent(timeZone)}` : ''
        const [analyticsRes, taskStatsRes, summaryRes] = await Promise.all([
          fetch(`/api/time-entries/analytics?days=30${tzQ}`),
          fetch(`/api/time-entries/tasks?limit=10&sortBy=${encodeURIComponent(tasksSort)}${tzQ}`),
          fetch(`/api/time-entries/summary${tzQ2}`)
        ])

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          setAnalytics(analyticsData)
        }

        if (taskStatsRes.ok) {
          const taskStatsData = await taskStatsRes.json()
          setTaskStats(taskStatsData)
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json()
          setSummary(summaryData)
        }
      } catch (error) {
        console.error('時間追跡データの取得に失敗:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // 計測開始/停止などのイベントで即時更新
    const onChanged = () => {
      try {
        const runId = typeof window !== 'undefined' ? localStorage.getItem('time:runningTodoId') : null
        setRunningTodoId(runId)
      } catch {}
      fetchData()
    }
    const onVisibility = () => { if (!document.hidden) fetchData() }
    if (typeof window !== 'undefined') {
      window.addEventListener('todo:changed', onChanged)
      // タブ復帰時にも更新
      window.addEventListener('visibilitychange', onVisibility)
      try { setRunningTodoId(localStorage.getItem('time:runningTodoId')) } catch {}
    }
    
    // 更新間隔を短縮（60秒）
    const interval = setInterval(fetchData, 60 * 1000)
    return () => {
      clearInterval(interval)
      if (typeof window !== 'undefined') {
        window.removeEventListener('todo:changed', onChanged)
        window.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [session, timeZone, tasksSort])

  // タイムゾーン変更イベントを購読
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onTzChanged = (e: any) => {
      const tz = e?.detail || ((): string => { try { return localStorage.getItem('time:tz') || 'UTC' } catch { return 'UTC' } })()
      setTimeZone(tz)
    }
    window.addEventListener('time:tz-changed', onTzChanged)
    return () => window.removeEventListener('time:tz-changed', onTzChanged)
  }, [])

  // 概要タブ向け: 進行中分の“見える化”オーバーレイ
  const overlayedAnalytics = useMemo((): TimeAnalytics | null => {
    if (!analytics) return null
    const a = { ...analytics }
    if (!summary) return a
    const todayStr = new Date().toISOString().split('T')[0]
    const endedToday = (a.dailyStats || []).find(d => d.date === todayStr)?.seconds || 0
    const addSec = Math.max(0, (summary.todaySeconds || 0) - endedToday)
    if (addSec > 0) {
      // dailyStats を更新
      const newDaily = [...(a.dailyStats || [])]
      const idx = newDaily.findIndex(d => d.date === todayStr)
      if (idx >= 0) newDaily[idx] = { ...newDaily[idx], seconds: newDaily[idx].seconds + addSec }
      else newDaily.push({ date: todayStr, seconds: addSec })
      a.dailyStats = newDaily
      a.totalSeconds = (a.totalSeconds || 0) + addSec
      // 週平均は概算のまま維持（必要なら厳密計算に変更可）
    }
    return a
  }, [analytics, summary])

  // タスク統計のフォールバック（analytics に taskStats がある場合に活用）
  const effectiveTaskStats: TaskTimeStats | null = useMemo(() => {
    const base = (taskStats && Array.isArray(taskStats.taskStats) && taskStats.taskStats.length > 0)
      ? taskStats
      : null
    const a = overlayedAnalytics || analytics
    if (a && Array.isArray(a.taskStats) && a.taskStats.length > 0) {
      const worked = a.taskStats.filter(t => (t?.totalSeconds || 0) > 0)
      const totalWorkTime = worked.reduce((s, t) => s + (t.totalSeconds || 0), 0)
      const totalSessions = worked.reduce((s, t) => s + (t.sessions || 0), 0)
      const overlay: TaskTimeStats = base || {
        taskStats: a.taskStats as any,
        totalTasks: a.taskStats.length,
        workedTasks: worked.length,
        totalWorkTime,
        totalSessions,
        hourlyProductivity: [],
        mostProductiveHour: { hour: 9, seconds: 0 }
      }
      // 進行中セッションの見える化（今日分の差分を当該タスクに加算）
      if (runningTodoId && summary) {
        const todayStr = new Date().toISOString().split('T')[0]
        const endedToday = (overlayedAnalytics || analytics)?.dailyStats?.find(d => d.date === todayStr)?.seconds || 0
        const addSec = Math.max(0, (summary.todaySeconds || 0) - endedToday)
        if (addSec > 0) {
          const list = [...(overlay.taskStats || [])]
          const idx = list.findIndex(t => String(t.taskId) === String(runningTodoId))
          if (idx >= 0) {
            list[idx] = { ...list[idx], totalSeconds: (list[idx].totalSeconds || 0) + addSec }
          }
          overlay.taskStats = list
          overlay.totalWorkTime = (overlay.totalWorkTime || 0) + addSec
          // 時間帯別の概算オーバーレイ（現在時刻に加算）
          const hour = new Date().getHours()
          const hp = overlay.hourlyProductivity?.length ? [...overlay.hourlyProductivity] : Array.from({ length: 24 }, (_, h) => ({ hour: h, seconds: 0 }))
          const hidx = hp.findIndex(h => h.hour === hour)
          if (hidx >= 0) hp[hidx] = { ...hp[hidx], seconds: (hp[hidx].seconds || 0) + addSec }
          overlay.hourlyProductivity = hp
          overlay.mostProductiveHour = hp.reduce((best, cur) => cur.seconds > best.seconds ? cur : best, { hour: 9, seconds: 0 })
        }
      }
      return overlay
    }
    return base
  }, [taskStats, analytics, overlayedAnalytics, runningTodoId, summary])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}時間${minutes}分`
    }
    return `${minutes}分`
  }

  const formatHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`
  }

  // 補助: タスク統計のサマリ計算（右サイド要約で使用）
  const taskTotals = useMemo(() => {
    if (!effectiveTaskStats) return null
    const totalWorkTime = effectiveTaskStats.totalWorkTime || 0
    const totalSessions = effectiveTaskStats.totalSessions || 0
    const workedTasks = effectiveTaskStats.workedTasks || 0
    const avgSessionTime = totalSessions > 0 ? Math.round(totalWorkTime / totalSessions) : 0
    // カテゴリ別合計
    const byCat = new Map<string, number>()
    for (const t of effectiveTaskStats.taskStats || []) {
      const key = t.taskCategory || 'uncategorized'
      byCat.set(key, (byCat.get(key) || 0) + (t.totalSeconds || 0))
    }
    let topCategory = 'カテゴリなし'
    let topCategorySeconds = 0
    for (const [k, v] of byCat.entries()) {
      if (v > topCategorySeconds) { topCategory = k; topCategorySeconds = v }
    }
    return { totalWorkTime, totalSessions, workedTasks, avgSessionTime, topCategory, topCategorySeconds }
  }, [effectiveTaskStats])

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 rounded-t-xl">
        <nav className="-mb-px flex px-2 sm:px-4">
          {[
            { id: 'overview', label: '📊 概要', icon: '📊' },
            { id: 'tasks', label: '🎯 タスク別', icon: '🎯' },
            { id: 'productivity', label: '⚡ 生産性', icon: '⚡' },
            { id: 'goals', label: '🏆 目標', icon: '🏆' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors rounded-t-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-300 bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6 sm:p-7">
        {/* 概要タブ */}
        {activeTab === 'overview' && overlayedAnalytics && (
          <div className="space-y-6">
            {/* KPI カード（表示順を Today / Week / Total / Consistency に最適化） */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-4">
              <div className="rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                <div className="text-sm text-purple-600 dark:text-purple-400">今日</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-200">
                  {summary ? formatTime(summary.todaySeconds || 0) : '-'}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 shadow-sm">
                <div className="text-sm text-blue-600 dark:text-blue-400">今週</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">
                  {summary ? formatTime(summary.weekSeconds || 0) : '-'}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/30 shadow-sm">
                <div className="text-sm text-green-600 dark:text-green-400">総作業時間</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-200">
                  {formatTime(overlayedAnalytics.totalSeconds)}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 shadow-sm">
                <div className="text-sm text-amber-600 dark:text-amber-400">一貫性</div>
                <div className="text-2xl font-bold text-amber-700 dark:text-amber-200">
                  {overlayedAnalytics.productivity?.consistency?.toFixed(0) || '0'}%
                </div>
              </div>
            </div>

            {/* 日次チャート + インサイト（2カラム） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
              <div className="md:col-span-2 card">
                <div className="card-section">
                  <h3 className="section-title mb-3">📈 過去30日間の作業時間</h3>
                  <div className="grid grid-cols-7 gap-1 text-[11px]">
                    {(overlayedAnalytics.dailyStats || []).slice(-30).map((day, index) => {
                      const maxSeconds = Math.max(...(overlayedAnalytics.dailyStats || []).map(d => d?.seconds || 0))
                      const height = maxSeconds > 0 ? Math.max(4, ((day?.seconds || 0) / maxSeconds) * 60) : 4
                      return (
                        <div key={index} className="flex flex-col items-center">
                          <div
                            className="w-full bg-gradient-to-t from-purple-400/70 to-purple-200/70 dark:from-purple-600 dark:to-purple-400 rounded-sm transition-all"
                            style={{ height: `${height}px` }}
                            title={`${day?.date || ''}: ${formatTime(day?.seconds || 0)}`}
                          />
                          <span className="mt-1 text-gray-500 dark:text-gray-400">
                            {day?.date ? new Date(day.date).getDate() : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-section">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">インサイト</h4>
                  <ul className="text-sm space-y-1">
                    <li className="muted">最も作業した日: <span className="text-gray-800 dark:text-gray-100">{overlayedAnalytics.productivity?.bestDay || '記録なし'}</span></li>
                    <li className="muted">最も少ない日: <span className="text-gray-800 dark:text-gray-100">{overlayedAnalytics.productivity?.worstDay || '記録なし'}</span></li>
                    <li className="muted">週平均: <span className="text-gray-800 dark:text-gray-100">{formatTime(overlayedAnalytics.weeklyAverage || 0)}</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* タスク別タブ */}
        {activeTab === 'tasks' && effectiveTaskStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">🏆 作業時間ランキング</h3>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                    {effectiveTaskStats?.workedTasks || 0} / {effectiveTaskStats?.totalTasks || 0} タスク
                  </div>
                  <label className="text-xs muted">並び替え</label>
                  <select
                    value={tasksSort}
                    onChange={(e) => setTasksSort(e.target.value as any)}
                    className="select-base text-xs"
                  >
                    <option value="totalTime">総時間</option>
                    <option value="sessions">セッション数</option>
                    <option value="efficiency">平均/セッション</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                {(effectiveTaskStats.taskStats || []).length > 0 ? (effectiveTaskStats.taskStats || []).map((task, index) => (
                  <div key={task.taskId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/70 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <span className="text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                          {task?.taskTitle || 'タイトルなし'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-300">
                          {task?.sessions || 0}セッション • 平均{formatTime(task?.avgSessionTime || 0)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatTime(task?.totalSeconds || 0)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-300">
                        {task?.taskCategory || 'カテゴリなし'}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-2">⏰</div>
                    <div>まだ作業時間の記録がありません</div>
                    <div className="text-sm">タスクの時間追跡を開始してみましょう</div>
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <div className="card-section">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">要約</h4>
                <dl className="text-sm space-y-1">
                  <div className="flex justify-between"><dt className="muted">合計時間</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{formatTime(taskTotals?.totalWorkTime || 0)}</dd></div>
                  <div className="flex justify-between"><dt className="muted">合計セッション</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{taskTotals?.totalSessions || 0}</dd></div>
                  <div className="flex justify-between"><dt className="muted">平均/セッション</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{formatTime(taskTotals?.avgSessionTime || 0)}</dd></div>
                  <div className="flex justify-between"><dt className="muted">作業済みタスク</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{taskTotals?.workedTasks || 0}</dd></div>
                  <div className="flex justify-between"><dt className="muted">トップカテゴリ</dt><dd className="font-medium text-gray-900 dark:text-gray-100">{taskTotals?.topCategory || 'カテゴリなし'}</dd></div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {/* 生産性タブ */}
        {activeTab === 'productivity' && effectiveTaskStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 card">
              <div className="card-section">
                <h3 className="section-title mb-2">🕐 時間帯別生産性</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  最も生産的な時間: {formatHour(effectiveTaskStats.mostProductiveHour?.hour || 9)} ({formatTime(effectiveTaskStats.mostProductiveHour?.seconds || 0)})
                </div>
                <div className="grid grid-cols-12 gap-1 text-xs">
                  {(effectiveTaskStats.hourlyProductivity || []).map((hourData) => {
                    const maxSeconds = Math.max(...(effectiveTaskStats.hourlyProductivity || []).map(h => h?.seconds || 0))
                    const height = maxSeconds > 0 ? Math.max(4, ((hourData?.seconds || 0) / maxSeconds) * 80) : 4
                    return (
                      <div key={hourData?.hour || 0} className="flex flex-col items-center">
                        <div
                          className="w-full bg-gradient-to-t from-blue-400 to-blue-200 dark:from-blue-600 dark:to-blue-400 rounded-sm"
                          style={{ height: `${height}px` }}
                          title={`${formatHour(hourData?.hour || 0)}: ${formatTime(hourData?.seconds || 0)}`}
                        />
                        <span className="mt-1 text-gray-500 dark:text-gray-400">
                          {hourData?.hour || 0}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-section">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">トップ時間帯</h4>
                <ul className="text-sm space-y-1">
                  {([...((effectiveTaskStats.hourlyProductivity || []))]
                    .sort((a, b) => (b?.seconds || 0) - (a?.seconds || 0))
                    .slice(0, 3)
                  ).map((h) => (
                    <li key={h.hour} className="flex justify-between">
                      <span className="muted">{formatHour(h.hour)}</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatTime(h.seconds || 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* 目標タブ */}
        {activeTab === 'goals' && (
          <TimeGoalSetting />
        )}
      </div>
    </div>
  )
}
