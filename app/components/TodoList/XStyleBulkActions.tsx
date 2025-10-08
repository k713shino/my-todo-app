'use client'

import { Status } from '@prisma/client'

interface XStyleBulkActionsProps {
  isSelectionMode: boolean
  selectedCount: number
  totalCount: number
  isBulkOperating: boolean
  onToggleSelection: () => void
  onSelectAll: () => void
  onBulkStatusUpdate: (status: Status) => Promise<void>
  onBulkDelete: () => Promise<void>
}

export default function XStyleBulkActions({
  isSelectionMode,
  selectedCount,
  totalCount,
  isBulkOperating,
  onToggleSelection,
  onSelectAll,
  onBulkStatusUpdate,
  onBulkDelete,
}: XStyleBulkActionsProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount

  return (
    <div className="px-4 pt-4">
      <div className={`flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900/70 ${isSelectionMode ? 'ring-1 ring-blue-400/40 dark:ring-blue-500/30' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleSelection}
              disabled={totalCount === 0 && !isSelectionMode}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                isSelectionMode
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-300/60 hover:bg-blue-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50'
              }`}
            >
              {isSelectionMode ? '選択モード終了' : '選択モード'}
            </button>

            {isSelectionMode && (
              <>
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-500 dark:border-slate-600 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
                >
                  {allSelected ? '全解除' : '全選択'}
                </button>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {selectedCount} / {totalCount}
                </span>
              </>
            )}
          </div>

          {isSelectionMode && selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onBulkStatusUpdate('TODO')}
                  disabled={isBulkOperating}
                  className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  📝 未着手
                </button>
                <button
                  type="button"
                  onClick={() => onBulkStatusUpdate('IN_PROGRESS')}
                  disabled={isBulkOperating}
                  className="rounded-full bg-blue-100 px-3 py-1 text-[11px] text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
                >
                  🔄 作業中
                </button>
                <button
                  type="button"
                  onClick={() => onBulkStatusUpdate('REVIEW')}
                  disabled={isBulkOperating}
                  className="rounded-full bg-amber-100 px-3 py-1 text-[11px] text-amber-700 transition-colors hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                >
                  👀 確認中
                </button>
                <button
                  type="button"
                  onClick={() => onBulkStatusUpdate('DONE')}
                  disabled={isBulkOperating}
                  className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                >
                  ✅ 完了
                </button>
              </div>
              <button
                type="button"
                onClick={onBulkDelete}
                disabled={isBulkOperating}
                className="rounded-full bg-rose-100 px-3 py-1 text-[11px] text-rose-700 transition-colors hover:bg-rose-200 disabled:opacity-50 dark:bg-rose-900/30 dark:text-rose-200 dark:hover:bg-rose-900/50"
              >
                🗑️ 選択削除
              </button>
              {isBulkOperating && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-300">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-blue-500 border-t-transparent" />
                  処理中...
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
