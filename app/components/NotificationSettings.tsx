'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

const USER_PREF_KEY = 'notify:deadline:enabled'
const MINUTES_KEY = 'notify:deadline:minutes'

export default function NotificationSettings() {
  const [supported, setSupported] = useState<boolean>(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [enabled, setEnabled] = useState<boolean>(true)
  const [minutes, setMinutes] = useState<number>(15)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSupported('Notification' in window)
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
    try {
      const e = localStorage.getItem(USER_PREF_KEY)
      if (e !== null) setEnabled(e === 'true')
      const m = localStorage.getItem(MINUTES_KEY)
      if (m) setMinutes(Math.max(1, parseInt(m)))
    } catch {}
  }, [])

  const requestPermission = async () => {
    if (!supported) return
    if (Notification.permission === 'granted') {
      toast.success('通知は既に許可されています')
      setPermission('granted')
      return
    }
    const perm = await Notification.requestPermission()
    setPermission(perm)
    if (perm === 'granted') {
      toast.success('通知が許可されました')
    } else if (perm === 'denied') {
      toast.error('通知がブロックされています（ブラウザ設定を確認）')
    }
  }

  const handleToggle = (v: boolean) => {
    setEnabled(v)
    try { localStorage.setItem(USER_PREF_KEY, String(v)) } catch {}
    toast.success(v ? '通知を有効にしました' : '通知を無効にしました')
  }

  const handleMinutes = (v: number) => {
    setMinutes(v)
    try { localStorage.setItem(MINUTES_KEY, String(v)) } catch {}
    toast.success(`通知タイミングを${v}分前に設定しました`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">⏰ 通知設定</h2>
      {!supported ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">このブラウザは通知をサポートしていません。</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">期限通知を有効化</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">期限の{minutes}分前に通知（トースト + ブラウザ通知）</p>
            </div>
            <button
              onClick={() => handleToggle(!enabled)}
              className={`px-3 py-1.5 rounded-md text-sm ${enabled ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">通知タイミング</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">期限の何分前に通知するかを選択</p>
            </div>
            <select
              value={minutes}
              onChange={(e) => handleMinutes(parseInt(e.target.value))}
              className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {[5,10,15,30,60].map(m => (
                <option key={m} value={m}>{m} 分前</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 dark:text-white font-medium">ブラウザ通知の権限</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">現在: {permission}</p>
            </div>
            <button
              onClick={requestPermission}
              className="px-3 py-1.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              権限をリクエスト
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

