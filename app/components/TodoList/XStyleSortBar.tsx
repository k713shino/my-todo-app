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
    <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="px-4 py-3 flex items-center gap-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400 font-medium">並び替え:</span>

        {/* ソート基準 */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as 'createdAt' | 'dueDate' | 'priority')}
            className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 pr-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* ソート順序 */}
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => onSortOrderChange(e.target.value as 'asc' | 'desc')}
            className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full px-4 py-1.5 pr-8 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {orderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
