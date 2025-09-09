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
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'productivity' | 'goals'>('overview')
  const [loading, setLoading] = useState(true)

  // データ取得
  useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [analyticsRes, taskStatsRes, summaryRes] = await Promise.all([
          fetch('/api/time-entries/analytics?days=30'),
          fetch('/api/time-entries/tasks?limit=10&sortBy=totalTime'),
          fetch('/api/time-entries/summary')
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
  }, [session])

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
          const idx = list.findIndex(t => t.taskId === runningTodoId)
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

  if (!session?.user) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* タブナビゲーション */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex">
          {[
            { id: 'overview', label: '📊 概要', icon: '📊' },
            { id: 'tasks', label: '🎯 タスク別', icon: '🎯' },
            { id: 'productivity', label: '⚡ 生産性', icon: '⚡' },
            { id: 'goals', label: '🏆 目標', icon: '🏆' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* 概要タブ */}
        {activeTab === 'overview' && overlayedAnalytics && (
          <div className="space-y-6">
            {/* KPI カード */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                <div className="text-sm text-blue-600 dark:text-blue-400">総作業時間</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatTime(overlayedAnalytics.totalSeconds)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
                <div className="text-sm text-green-600 dark:text-green-400">週平均</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatTime(overlayedAnalytics.weeklyAverage)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
                <div className="text-sm text-purple-600 dark:text-purple-400">一貫性</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {overlayedAnalytics.productivity?.consistency?.toFixed(0) || '0'}%
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4">
                <div className="text-sm text-orange-600 dark:text-orange-400">最高の日</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {overlayedAnalytics.productivity?.bestDay || '記録なし'}
                </div>
              </div>
            </div>

            {/* 日次チャート（簡易版） */}
            <div>
              <h3 className="text-lg font-semibold mb-4">📈 過去30日間の作業時間</h3>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {(overlayedAnalytics.dailyStats || []).slice(-30).map((day, index) => {
                  const maxSeconds = Math.max(...(overlayedAnalytics.dailyStats || []).map(d => d?.seconds || 0))
                  const height = maxSeconds > 0 ? Math.max(4, ((day?.seconds || 0) / maxSeconds) * 60) : 4
                  
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className="w-full bg-purple-200 dark:bg-purple-700 rounded-sm"
                        style={{ height: `${height}px` }}
                        title={`${day?.date || ''}: ${formatTime(day?.seconds || 0)}`}
                      ></div>
                      <span className="mt-1 text-gray-500 dark:text-gray-400">
                        {day?.date ? new Date(day.date).getDate() : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* タスク別タブ */}
        {activeTab === 'tasks' && effectiveTaskStats && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">🏆 作業時間ランキング</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {effectiveTaskStats?.workedTasks || 0} / {effectiveTaskStats?.totalTasks || 0} タスク
              </div>
            </div>
            
            <div className="space-y-2">
              {(effectiveTaskStats.taskStats || []).length > 0 ? (effectiveTaskStats.taskStats || []).map((task, index) => (
                <div key={task.taskId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <span className="text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {task?.taskTitle || 'タイトルなし'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {task?.sessions || 0}セッション • 平均{formatTime(task?.avgSessionTime || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatTime(task?.totalSeconds || 0)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
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
        )}

        {/* 生産性タブ */}
        {activeTab === 'productivity' && effectiveTaskStats && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">🕐 時間帯別生産性</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                最も生産的な時間: {formatHour(effectiveTaskStats.mostProductiveHour?.hour || 9)} 
                ({formatTime(effectiveTaskStats.mostProductiveHour?.seconds || 0)})
              </div>
              
              {/* 時間帯バーチャート */}
              <div className="grid grid-cols-12 gap-1 text-xs">
                {(effectiveTaskStats.hourlyProductivity || []).map((hourData) => {
                  const maxSeconds = Math.max(...(effectiveTaskStats.hourlyProductivity || []).map(h => h?.seconds || 0))
                  const height = maxSeconds > 0 ? Math.max(4, ((hourData?.seconds || 0) / maxSeconds) * 80) : 4
                  
                  return (
                    <div key={hourData?.hour || 0} className="flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-purple-400 to-purple-200 dark:from-purple-600 dark:to-purple-400 rounded-sm"
                        style={{ height: `${height}px` }}
                        title={`${formatHour(hourData?.hour || 0)}: ${formatTime(hourData?.seconds || 0)}`}
                      ></div>
                      <span className="mt-1 text-gray-500 dark:text-gray-400">
                        {hourData?.hour || 0}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 生産性インサイト */}
            <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                💡 生産性のヒント
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• 最も集中できる時間帯を活用しましょう</li>
                <li>• 短時間でも継続的な作業が効果的です</li>
                <li>• 定期的な休憩で生産性を維持しましょう</li>
              </ul>
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
