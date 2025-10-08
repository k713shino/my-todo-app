'use client'

interface XStyleSortBarProps {
  sortBy: 'createdAt' | 'dueDate' | 'priority'
  sortOrder: 'asc' | 'desc'
  onSortByChange: (value: 'createdAt' | 'dueDate' | 'priority') => void
  onSortOrderChange: (value: 'asc' | 'desc') => void
}

/**
 * X風のソート選択バー
 */
export default function XStyleSortBar({
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
}: XStyleSortBarProps) {
  const sortOptions = [
    { value: 'createdAt', label: '作成日時' },
    { value: 'dueDate', label: '期限' },
    { value: 'priority', label: '優先度' },
  ] as const

  const orderOptions = [
    { value: 'desc', label: '降順' },
    { value: 'asc', label: '昇順' },
  ] as const

  return (
    <div className="border-b border-slate-200/80 bg-white/70 backdrop-blur-sm shadow-sm transition-colors dark:border-gray-800/70 dark:bg-gray-900/80">
      <div className="px-5 py-4 flex items-center gap-3 text-sm">
        <span className="text-slate-500 dark:text-gray-400 font-medium">並び替え:</span>

        {/* ソート基準 */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as 'createdAt' | 'dueDate' | 'priority')}
            className="appearance-none bg-white/90 border border-slate-200/80 rounded-full px-4 py-1.5 pr-9 text-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-blue-300 hover:bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ソート順序 */}
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
            className="appearance-none bg-white/90 border border-slate-200/80 rounded-full px-4 py-1.5 pr-9 text-slate-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 hover:border-blue-300 hover:bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            {orderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
