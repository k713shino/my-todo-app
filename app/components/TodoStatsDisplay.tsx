import { TodoStats } from '@/types/todo'

interface TodoStatsDisplayProps {
  stats: TodoStats
}

export default function TodoStatsDisplay({ stats }: TodoStatsDisplayProps) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 text-white p-6 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-purple-400/20 dark:border-purple-500/30">
      <h2 className="text-2xl font-bold mb-4 text-white">📊 あなたのTodo統計</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-white/90 dark:text-white/80">総数</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-300 dark:text-green-200">{stats.completed}</div>
          <div className="text-sm text-white/90 dark:text-white/80">完了</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-300 dark:text-yellow-200">{stats.active}</div>
          <div className="text-sm text-white/90 dark:text-white/80">未完了</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-300 dark:text-red-200">{stats.overdue}</div>
          <div className="text-sm text-white/90 dark:text-white/80">期限切れ</div>
        </div>
      </div>

      {/* 完了率 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1 text-white">
          <span>完了率</span>
          <span>{completionRate}%</span>
        </div>
        <div className="w-full bg-white/30 dark:bg-white/20 rounded-full h-2">
          <div
            className="bg-green-300 dark:bg-green-400 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* 優先度別統計 */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center bg-white/20 dark:bg-white/15 rounded p-2 backdrop-blur-sm">
          <div className="font-bold text-white">🔴 {stats.byPriority.urgent}</div>
          <div className="text-white/90 dark:text-white/80">緊急</div>
        </div>
        <div className="text-center bg-white/20 dark:bg-white/15 rounded p-2 backdrop-blur-sm">
          <div className="font-bold text-white">🟠 {stats.byPriority.high}</div>
          <div className="text-white/90 dark:text-white/80">高</div>
        </div>
        <div className="text-center bg-white/20 dark:bg-white/15 rounded p-2 backdrop-blur-sm">
          <div className="font-bold text-white">🟡 {stats.byPriority.medium}</div>
          <div className="text-white/90 dark:text-white/80">中</div>
        </div>
        <div className="text-center bg-white/20 dark:bg-white/15 rounded p-2 backdrop-blur-sm">
          <div className="font-bold text-white">🟢 {stats.byPriority.low}</div>
          <div className="text-white/90 dark:text-white/80">低</div>
        </div>
      </div>
    </div>
  )
}
