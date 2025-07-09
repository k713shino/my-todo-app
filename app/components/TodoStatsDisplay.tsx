import { TodoStats } from '@/types/todo'

interface TodoStatsDisplayProps {
  stats: TodoStats
}

export default function TodoStatsDisplay({ stats }: TodoStatsDisplayProps) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">📊 あなたのTodo統計</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-3xl font-bold">{stats.total}</div>
          <div className="text-sm opacity-90">総数</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-300">{stats.completed}</div>
          <div className="text-sm opacity-90">完了</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-yellow-300">{stats.active}</div>
          <div className="text-sm opacity-90">未完了</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-300">{stats.overdue}</div>
          <div className="text-sm opacity-90">期限切れ</div>
        </div>
      </div>

      {/* 完了率 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span>完了率</span>
          <span>{completionRate}%</span>
        </div>
        <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
          <div
            className="bg-green-300 h-2 rounded-full transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* 優先度別統計 */}
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div className="text-center bg-white bg-opacity-20 rounded p-2">
          <div className="font-bold">🔴 {stats.byPriority.urgent}</div>
          <div>緊急</div>
        </div>
        <div className="text-center bg-white bg-opacity-20 rounded p-2">
          <div className="font-bold">🟠 {stats.byPriority.high}</div>
          <div>高</div>
        </div>
        <div className="text-center bg-white bg-opacity-20 rounded p-2">
          <div className="font-bold">🟡 {stats.byPriority.medium}</div>
          <div>中</div>
        </div>
        <div className="text-center bg-white bg-opacity-20 rounded p-2">
          <div className="font-bold">🟢 {stats.byPriority.low}</div>
          <div>低</div>
        </div>
      </div>
    </div>
  )
}
