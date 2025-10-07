'use client'

interface XStyleTabsProps {
  activeView: 'all' | 'status' | 'calendar' | 'kanban'
  onViewChange: (view: 'all' | 'status' | 'calendar' | 'kanban') => void
  counts?: {
    all: number
    status: number
    calendar: number
    kanban: number
  }
}

/**
 * X (Twitter) 風のタブナビゲーション
 * 特徴: シンプル、下線アニメーション、太字フォント
 */
export default function XStyleTabs({ activeView, onViewChange, counts }: XStyleTabsProps) {
  const tabs = [
    { id: 'all', label: 'すべて', count: counts?.all },
    { id: 'status', label: 'ステータス', count: counts?.status },
    { id: 'calendar', label: 'カレンダー', count: counts?.calendar },
    { id: 'kanban', label: 'ボード', count: counts?.kanban },
  ] as const

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-[53px] z-10">
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 px-4 py-4 text-[15px] font-medium transition-colors relative hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
              activeView === tab.id
                ? 'text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-500'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeView === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </span>

            {/* 下線 */}
            {activeView === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-t-full"></div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
