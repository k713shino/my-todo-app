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
    <div
      className="sticky z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm transition-colors dark:border-gray-800/70 dark:bg-gray-900/80"
      style={{ top: 'var(--x-tabs-offset, 64px)' }}
    >
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 px-4 py-4 text-[15px] font-semibold relative transition-colors duration-200 ${
              activeView === tab.id
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-100'
            } hover:bg-white/60 dark:hover:bg-gray-800/60`}
          >
            <span className="flex items-center justify-center gap-2">
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                  activeView === tab.id
                    ? 'bg-blue-500 text-white shadow-sm shadow-blue-200/60'
                    : 'bg-slate-200 text-slate-600 dark:bg-gray-700 dark:text-gray-300'
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
