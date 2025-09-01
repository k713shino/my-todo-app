'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import TodoList from '@/app/components/TodoList'
import DashboardHeader from '@/app/components/DashboardHeader'
import TodoStatsDisplay from '@/app/components/TodoStatsDisplay'
import type { TodoStats } from '@/types/todo'

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

  // ダッシュボード統計の取得（最小）
  const [stats, setStats] = useState<TodoStats | null>(null)
  useEffect(() => {
    let mounted = true
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/todos/stats?cache=false&refresh=true')
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
  }) => {
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
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* ヘッダー */}
      <DashboardHeader onModalSearch={handleModalSearch} />

      {/* メインコンテンツ - 固定ヘッダー分の上余白を追加 */}
      <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pt-20 sm:pt-24">
        <div className="max-w-7xl mx-auto">

          {/* 統計カード */}
          {stats && (
            <div className="mb-6 max-w-4xl mx-auto">
              <TodoStatsDisplay stats={stats} variant="neutral" showTimestamp={false} />
            </div>
          )}

          {/* 既存のTodoリスト */}
          <TodoList modalSearchValues={modalSearchValues} />
        </div>
      </main>
    </div>
  )
}
