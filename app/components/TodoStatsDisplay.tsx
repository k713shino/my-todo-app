import { TodoStats } from '@/types/todo'

type Variant = 'color' | 'neutral' | 'compact'

interface TodoStatsDisplayProps {
  stats: TodoStats
  variant?: Variant
  // 右上の更新時刻を表示するか
  showTimestamp?: boolean
  // 表示するタイムゾーン（例: 'Asia/Tokyo'）。未指定ならローカルタイムゾーン
  timeZone?: string
}

export default function TodoStatsDisplay({ stats, variant = 'color', showTimestamp = true, timeZone }: TodoStatsDisplayProps) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const weekly = stats.weeklyDone ?? 0
  const monthly = stats.monthlyDone ?? 0
  const maxBar = Math.max(weekly, monthly, 1)
  const lastUpdatedRaw = (stats as any)?.lastUpdated as string | undefined

  const formattedUpdated = (() => {
    if (!lastUpdatedRaw) return undefined
    try {
      const d = new Date(lastUpdatedRaw)
      const formatter = new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: timeZone || undefined
      })
      return formatter.format(d)
    } catch {
      return lastUpdatedRaw
    }
  })()

  if (variant === 'compact') {
    // コンパクト: ダッシュボードの小カードと同じサイズ感で4指標のみ
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">合計</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.active}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">未完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">期限切れ</div>
          </div>
        </div>
      </div>
    )
  }

  const wrapperClass =
    variant === 'neutral'
      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700'
      : 'bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 text-white p-6 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-purple-400/20 dark:border-purple-500/30'
  const mutedText = variant === 'neutral' ? 'text-gray-500 dark:text-gray-400' : 'text-white/90 dark:text-white/80'
  const cardBg = variant === 'neutral' ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white/20 dark:bg-white/15'
  const barBase = variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/30 dark:bg-white/20'

  return (
    <div className={wrapperClass}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`text-xl font-bold ${variant === 'neutral' ? 'text-gray-900 dark:text-white' : 'text-white'}`}>📊 あなたのTodo統計</h2>
        {showTimestamp && formattedUpdated && (
          <span className={`text-xs ${mutedText}`}>更新: {formattedUpdated}{timeZone ? ` (${timeZone})` : ''}</span>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-gray-900 dark:text-white' : 'text-white'}`}>{stats.total}</div>
          <div className={`text-sm ${mutedText}`}>総数</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-green-600 dark:text-green-300' : 'text-green-300 dark:text-green-200'}`}>{stats.completed}</div>
          <div className={`text-sm ${mutedText}`}>完了</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-yellow-600 dark:text-yellow-300' : 'text-yellow-300 dark:text-yellow-200'}`}>{stats.active}</div>
          <div className={`text-sm ${mutedText}`}>未完了</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-red-600 dark:text-red-300' : 'text-red-300 dark:text-red-200'}`}>{stats.overdue}</div>
          <div className={`text-sm ${mutedText}`}>期限切れ</div>
        </div>
      </div>

      {/* 完了率 */}
      <div className="mb-4">
        <div className={`flex justify-between text-sm mb-1 ${variant === 'neutral' ? 'text-gray-700 dark:text-gray-200' : 'text-white'}`}>
          <span>完了率</span>
          <span>{completionRate}%</span>
        </div>
        <div className={`w-full ${barBase} rounded-full h-2`}>
          <div className={`${variant === 'neutral' ? 'bg-green-500 dark:bg-green-400' : 'bg-green-300 dark:bg-green-400'} h-2 rounded-full transition-all duration-500`} style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* 優先度別統計 */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className={`text-center ${cardBg} rounded p-2 backdrop-blur-sm`}>
          <div className="font-bold text-white">🔴 {stats.byPriority.urgent}</div>
          <div className={`${mutedText}`}>緊急</div>
        </div>
        <div className={`text-center ${cardBg} rounded p-2 backdrop-blur-sm`}>
          <div className="font-bold text-white">🟠 {stats.byPriority.high}</div>
          <div className={`${mutedText}`}>高</div>
        </div>
        <div className={`text-center ${cardBg} rounded p-2 backdrop-blur-sm`}>
          <div className="font-bold text-white">🟡 {stats.byPriority.medium}</div>
          <div className={`${mutedText}`}>中</div>
        </div>
        <div className={`text-center ${cardBg} rounded p-2 backdrop-blur-sm`}>
          <div className="font-bold text-white">🟢 {stats.byPriority.low}</div>
          <div className={`${mutedText}`}>低</div>
        </div>
      </div>

      {/* 期間別（直近）完了数 */}
      <div className="mt-4">
        <div className={`text-sm mb-2 ${mutedText}`}>⏱ 期間別の完了数</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`${cardBg} rounded p-3`}>
            <div className={`flex justify-between mb-1 ${mutedText}`}>
              <span>直近1週間</span>
              <span className="font-semibold">{weekly}</span>
            </div>
            <div className={`w-full h-2 ${variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/25'} rounded`} aria-label={`直近1週間の完了数 ${weekly}`}>
              <div className={`h-2 rounded ${variant === 'neutral' ? 'bg-green-500 dark:bg-green-400' : 'bg-green-300'}`} style={{ width: `${Math.round((weekly / maxBar) * 100)}%` }} />
            </div>
          </div>
          <div className={`${cardBg} rounded p-3`}>
            <div className={`flex justify-between mb-1 ${mutedText}`}>
              <span>直近1ヶ月</span>
              <span className="font-semibold">{monthly}</span>
            </div>
            <div className={`w-full h-2 ${variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/25'} rounded`} aria-label={`直近1ヶ月の完了数 ${monthly}`}>
              <div className={`h-2 rounded ${variant === 'neutral' ? 'bg-blue-500 dark:bg-blue-400' : 'bg-blue-300'}`} style={{ width: `${Math.round((monthly / maxBar) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
