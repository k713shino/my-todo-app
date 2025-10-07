'use client'

import { Status } from '@prisma/client'

interface TodoBulkActionsProps {
  isSelectionMode: boolean
  selectedTodos: Set<string>
  isBulkOperating: boolean
  filteredTodosLength: number
  toggleSelectionMode: () => void
  handleSelectAll: () => void
  handleBulkStatusUpdate: (status: Status) => Promise<void>
  handleBulkDelete: () => Promise<void>
}

/**
 * Todoバルク操作UIコンポーネント
 */
export default function TodoBulkActions({
  isSelectionMode,
  selectedTodos,
  isBulkOperating,
  filteredTodosLength,
  toggleSelectionMode,
  handleSelectAll,
  handleBulkStatusUpdate,
  handleBulkDelete,
}: TodoBulkActionsProps) {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSelectionMode}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isSelectionMode
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border border-purple-600 dark:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30'
            }`}
          >
            {isSelectionMode ? '🚫 選択モード終了' : '✅ 選択モード開始'}
          </button>

          {isSelectionMode && (
            <>
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 border border-purple-600 dark:border-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30"
              >
                {selectedTodos.size === filteredTodosLength ? '全解除' : '全選択'}
              </button>

              <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
                {selectedTodos.size}件選択中
              </span>
            </>
          )}
        </div>

        {isSelectionMode && selectedTodos.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* バルクステータス更新 */}
            <div className="flex gap-1">
              <button
                onClick={() => handleBulkStatusUpdate('TODO')}
                disabled={isBulkOperating}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                📝 未着手
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('IN_PROGRESS')}
                disabled={isBulkOperating}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50 disabled:opacity-50"
              >
                🔄 作業中
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('REVIEW')}
                disabled={isBulkOperating}
                className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:hover:bg-orange-900/50 disabled:opacity-50"
              >
                👀 確認中
              </button>
              <button
                onClick={() => handleBulkStatusUpdate('DONE')}
                disabled={isBulkOperating}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50 disabled:opacity-50"
              >
                ✅ 完了
              </button>
            </div>

            {/* バルク削除 */}
            <button
              onClick={handleBulkDelete}
              disabled={isBulkOperating}
              className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 disabled:opacity-50"
            >
              🗑️ 削除
            </button>

            {isBulkOperating && (
              <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="w-3 h-3 border border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                処理中...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
