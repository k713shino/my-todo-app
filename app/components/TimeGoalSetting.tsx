'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'

interface TimeGoals {
  dailyGoal: number // 分単位
  weeklyGoal: number // 分単位
  notifications: {
    dailyReminder: boolean
    progressAlert: boolean
    goalAchieved: boolean
  }
}

interface Progress {
  progress: number // パーセンテージ
  achieved: boolean
  currentSeconds: number
  targetSeconds: number
  remainingSeconds: number
}

export default function TimeGoalSetting() {
  const { data: session } = useSession()
  const [goals, setGoals] = useState<TimeGoals>({
    dailyGoal: 480, // 8時間
    weeklyGoal: 2400, // 40時間
    notifications: {
      dailyReminder: true,
      progressAlert: true,
      goalAchieved: true
    }
  })
  const [dailyProgress, setDailyProgress] = useState<Progress | null>(null)
  const [weeklyProgress, setWeeklyProgress] = useState<Progress | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // 目標とプログレスを取得
  useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      try {
        // 目標取得
        const goalsRes = await fetch('/api/time-entries/goals')
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json()
          setGoals(goalsData)
        }

        // プログレス取得
        const [dailyRes, weeklyRes] = await Promise.all([
          fetch('/api/time-entries/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'daily' })
          }).catch(error => {
            console.warn('Daily progress fetch error:', error)
            return { ok: false }
          }),
          fetch('/api/time-entries/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'weekly' })
          }).catch(error => {
            console.warn('Weekly progress fetch error:', error)
            return { ok: false }
          })
        ])

        if (dailyRes?.ok && 'json' in dailyRes) {
          try {
            const dailyData = await dailyRes.json()
            setDailyProgress(dailyData)
          } catch (jsonError) {
            console.warn('Failed to parse daily progress:', jsonError)
          }
        }

        if (weeklyRes?.ok && 'json' in weeklyRes) {
          try {
            const weeklyData = await weeklyRes.json()
            setWeeklyProgress(weeklyData)
          } catch (jsonError) {
            console.warn('Failed to parse weekly progress:', jsonError)
          }
        }
      } catch (error) {
        console.error('目標データの取得に失敗:', error)
      }
    }

    fetchData()
    
    // 30秒ごとに進捗を更新
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [session])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/time-entries/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goals)
      })

      if (response.ok) {
        toast.success('目標を保存しました')
        setIsEditing(false)
      } else {
        throw new Error('保存に失敗しました')
      }
    } catch (error) {
      toast.error('目標の保存に失敗しました')
      console.error('Goal save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}時間${mins > 0 ? mins + '分' : ''}` : `${mins}分`
  }

  const formatSeconds = (seconds: number) => {
    return formatTime(Math.floor(seconds / 60))
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500'
    if (progress >= 75) return 'bg-blue-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getProgressMessage = (progress: Progress | null, type: string) => {
    if (!progress) return '📊 データを読み込み中...'
    if (progress.achieved) {
      return `🎉 ${type}目標達成！`
    }
    const remaining = formatSeconds(progress.remainingSeconds || 0)
    return `⏰ あと${remaining}で目標達成`
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          🎯 時間目標設定
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-sm px-3 py-1 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
        >
          {isEditing ? 'キャンセル' : '編集'}
        </button>
      </div>

      {isEditing ? (
        /* 編集モード */
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              日次目標 (時間)
            </label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={goals.dailyGoal / 60}
              onChange={(e) =>
                setGoals({
                  ...goals,
                  dailyGoal: Math.round(parseFloat(e.target.value) * 60)
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              週次目標 (時間)
            </label>
            <input
              type="number"
              min="2"
              max="168"
              step="1"
              value={goals.weeklyGoal / 60}
              onChange={(e) =>
                setGoals({
                  ...goals,
                  weeklyGoal: Math.round(parseFloat(e.target.value) * 60)
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700"
            />
          </div>

          {/* 通知設定 */}
          <div>
            <label className="block text-sm font-medium mb-2">通知設定</label>
            <div className="space-y-2">
              {[
                { key: 'dailyReminder', label: '日次目標リマインダー' },
                { key: 'progressAlert', label: '進捗アラート' },
                { key: 'goalAchieved', label: '目標達成通知' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={goals.notifications[key as keyof typeof goals.notifications]}
                    onChange={(e) =>
                      setGoals({
                        ...goals,
                        notifications: {
                          ...goals.notifications,
                          [key]: e.target.checked
                        }
                      })
                    }
                    className="mr-2 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {saving ? '保存中...' : '目標を保存'}
          </button>
        </div>
      ) : (
        /* 表示モード */
        <div className="space-y-6">
          {/* 日次進捗 */}
          {dailyProgress && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">今日の進捗</span>
                <span className="text-sm text-gray-500">
                  {formatSeconds(dailyProgress?.currentSeconds || 0)} / {formatTime(goals?.dailyGoal || 480)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(dailyProgress?.progress || 0)}`}
                  style={{ width: `${Math.min(100, dailyProgress?.progress || 0)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getProgressMessage(dailyProgress, '日次')}
              </p>
            </div>
          )}

          {/* 週次進捗 */}
          {weeklyProgress && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">今週の進捗</span>
                <span className="text-sm text-gray-500">
                  {formatSeconds(weeklyProgress?.currentSeconds || 0)} / {formatTime(goals?.weeklyGoal || 2400)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${getProgressColor(weeklyProgress?.progress || 0)}`}
                  style={{ width: `${Math.min(100, weeklyProgress?.progress || 0)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {getProgressMessage(weeklyProgress, '週次')}
              </p>
            </div>
          )}

          {/* 目標達成状況 */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-purple-600 dark:text-purple-400 font-medium">
                  日次目標
                </div>
                <div className="text-lg font-bold">
                  {formatTime(goals?.dailyGoal || 480)}
                </div>
              </div>
              <div>
                <div className="text-blue-600 dark:text-blue-400 font-medium">
                  週次目標
                </div>
                <div className="text-lg font-bold">
                  {formatTime(goals?.weeklyGoal || 2400)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}