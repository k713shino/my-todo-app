'use client'

import { useEffect, useState } from 'react'
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
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'productivity' | 'goals'>('overview')
  const [loading, setLoading] = useState(true)

  // データ取得
  useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [analyticsRes, taskStatsRes] = await Promise.all([
          fetch('/api/time-entries/analytics?days=30'),
          fetch('/api/time-entries/tasks?limit=10&sortBy=totalTime')
        ])

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          setAnalytics(analyticsData)
        }

        if (taskStatsRes.ok) {
          const taskStatsData = await taskStatsRes.json()
          setTaskStats(taskStatsData)
        }
      } catch (error) {
        console.error('時間追跡データの取得に失敗:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // 5分ごとに更新
    const interval = setInterval(fetchData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [session])

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
        {activeTab === 'overview' && analytics && (
          <div className="space-y-6">
            {/* KPI カード */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
                <div className="text-sm text-blue-600 dark:text-blue-400">総作業時間</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {formatTime(analytics.totalSeconds)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4">
                <div className="text-sm text-green-600 dark:text-green-400">週平均</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {formatTime(analytics.weeklyAverage)}
                </div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4">
                <div className="text-sm text-purple-600 dark:text-purple-400">一貫性</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {analytics.productivity.consistency.toFixed(0)}%
                </div>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg p-4">
                <div className="text-sm text-orange-600 dark:text-orange-400">最高の日</div>
                <div className="text-lg font-bold text-orange-700 dark:text-orange-300">
                  {analytics.productivity.bestDay || '記録なし'}
                </div>
              </div>
            </div>

            {/* 日次チャート（簡易版） */}
            <div>
              <h3 className="text-lg font-semibold mb-4">📈 過去30日間の作業時間</h3>
              <div className="grid grid-cols-7 gap-1 text-xs">
                {analytics.dailyStats.slice(-21).map((day, index) => {
                  const maxSeconds = Math.max(...analytics.dailyStats.map(d => d.seconds))
                  const height = maxSeconds > 0 ? Math.max(4, (day.seconds / maxSeconds) * 60) : 4
                  
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className="w-full bg-purple-200 dark:bg-purple-700 rounded-sm"
                        style={{ height: `${height}px` }}
                        title={`${day.date}: ${formatTime(day.seconds)}`}
                      ></div>
                      <span className="mt-1 text-gray-500 dark:text-gray-400">
                        {new Date(day.date).getDate()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* タスク別タブ */}
        {activeTab === 'tasks' && taskStats && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">🏆 作業時間ランキング</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {taskStats.workedTasks} / {taskStats.totalTasks} タスク
              </div>
            </div>
            
            <div className="space-y-2">
              {taskStats.taskStats.map((task, index) => (
                <div key={task.taskId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <span className="text-lg">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {task.taskTitle}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {task.sessions}セッション • 平均{formatTime(task.avgSessionTime)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatTime(task.totalSeconds)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {task.taskCategory || 'カテゴリなし'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 生産性タブ */}
        {activeTab === 'productivity' && taskStats && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">🕐 時間帯別生産性</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                最も生産的な時間: {formatHour(taskStats.mostProductiveHour.hour)} 
                ({formatTime(taskStats.mostProductiveHour.seconds)})
              </div>
              
              {/* 時間帯バーチャート */}
              <div className="grid grid-cols-12 gap-1 text-xs">
                {taskStats.hourlyProductivity.map((hourData) => {
                  const maxSeconds = Math.max(...taskStats.hourlyProductivity.map(h => h.seconds))
                  const height = maxSeconds > 0 ? Math.max(4, (hourData.seconds / maxSeconds) * 80) : 4
                  
                  return (
                    <div key={hourData.hour} className="flex flex-col items-center">
                      <div 
                        className="w-full bg-gradient-to-t from-purple-400 to-purple-200 dark:from-purple-600 dark:to-purple-400 rounded-sm"
                        style={{ height: `${height}px` }}
                        title={`${formatHour(hourData.hour)}: ${formatTime(hourData.seconds)}`}
                      ></div>
                      <span className="mt-1 text-gray-500 dark:text-gray-400">
                        {hourData.hour}
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