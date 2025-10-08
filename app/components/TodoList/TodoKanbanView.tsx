'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status, Priority } from '@prisma/client'
import type { Todo } from '@/types/todo'

interface TodoKanbanViewProps {
  filteredTodos: Todo[]
  draggedTodo: Todo | null
  dragOverColumn: Status | null
  setEditingTodo: (todo: Todo) => void
  handleDragStart: (e: React.DragEvent, todo: Todo) => void
  handleDragEnd: (e: React.DragEvent) => void
  handleDragOver: (e: React.DragEvent, status: Status) => void
  handleDragLeave: (e: React.DragEvent) => void
  handleDrop: (e: React.DragEvent, status: Status) => void
  handleUpdateTodo: (id: string, data: Record<string, unknown>) => Promise<void>
  getNextStatus: (status: Status) => Status
  PRIORITY_LABELS: Record<Priority, string>
}

/**
 * Todoかんばん表示コンポーネント
 */
export default function TodoKanbanView({
  filteredTodos,
  draggedTodo,
  dragOverColumn,
  setEditingTodo,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleUpdateTodo,
  getNextStatus,
  PRIORITY_LABELS,
}: TodoKanbanViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          🗂️ ワークフローかんばん
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {draggedTodo ? (
            <span className="font-medium text-purple-600 dark:text-purple-400">
              🎯 タスクをドラッグ中... ドロップ先を選んでください
            </span>
          ) : (
            'タスクをドラッグ&ドロップでワークフロー管理'
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { status: 'TODO' as Status, label: '📝 未着手', color: 'gray' },
          { status: 'IN_PROGRESS' as Status, label: '🔄 作業中', color: 'blue' },
          { status: 'REVIEW' as Status, label: '👀 確認中', color: 'orange' },
          { status: 'DONE' as Status, label: '✅ 完了', color: 'green' },
        ].map(({ status, label, color }) => {
          const columnTodos = filteredTodos.filter(t => t.status === status)
          const totalPoints = columnTodos.reduce((sum, todo) => sum + (todo.priority === 'URGENT' ? 4 : todo.priority === 'HIGH' ? 3 : todo.priority === 'MEDIUM' ? 2 : 1), 0)

          return (
            <div
              key={status}
              className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-lg p-3 min-h-[500px] border-2 transition-colors ${
                dragOverColumn === status
                  ? `border-${color}-400 bg-${color}-100 dark:bg-${color}-900/40 shadow-lg`
                  : `border-${color}-200 dark:border-${color}-700`
              }`}
              data-drop-zone="true"
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragOver(e, status)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDragLeave(e)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleDrop(e, status)
              }}
            >
              <div className="sticky top-0 bg-inherit z-10 pb-3 mb-3 border-b border-current border-opacity-20">
                <h4 className={`font-semibold text-${color}-800 dark:text-${color}-200 flex items-center justify-between`}>
                  <span className="flex items-center gap-2">
                    {label}
                    <div className="w-6 h-6 bg-current bg-opacity-20 rounded-full flex items-center justify-center text-xs font-bold">
                      {columnTodos.length}
                    </div>
                  </span>
                  <div className="text-xs opacity-75">
                    {totalPoints}pt
                  </div>
                </h4>
                <div className="text-xs opacity-70 mt-1">
                  {status === 'TODO' && 'バックログ・計画段階'}
                  {status === 'IN_PROGRESS' && '実作業・開発中'}
                  {status === 'REVIEW' && 'レビュー・確認待ち'}
                  {status === 'DONE' && 'リリース準備完了'}
                </div>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {columnTodos
                  .sort((a, b) => {
                    const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
                    if (priorityWeight[a.priority] !== priorityWeight[b.priority]) {
                      return priorityWeight[b.priority] - priorityWeight[a.priority]
                    }
                    if (a.dueDate && b.dueDate) {
                      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                    }
                    return 0
                  })
                  .map(todo => {
                    const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && status !== 'DONE'
                    const priorityColor = todo.priority === 'URGENT' ? 'red' : todo.priority === 'HIGH' ? 'orange' : todo.priority === 'MEDIUM' ? 'yellow' : 'green'

                    return (
                      <div
                        key={todo.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation()
                          handleDragStart(e, todo)
                        }}
                        onDragEnd={(e) => {
                          e.stopPropagation()
                          handleDragEnd(e)
                        }}
                        className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 p-4 hover:shadow-md transition-all group cursor-grab active:cursor-grabbing select-none ${
                          isOverdue ? 'border-l-red-500 bg-red-50 dark:bg-red-900/10' :
                          `border-l-${priorityColor}-400`
                        } ${status === 'DONE' ? 'opacity-75' : ''} ${
                          draggedTodo?.id === todo.id ? 'opacity-50 scale-95' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`font-medium text-sm cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 flex-1 ${
                              status === 'DONE' ? 'line-through' : ''
                            }`}
                            onClick={() => setEditingTodo(todo)}
                          >
                            {todo.title}
                          </div>
                          <div className="flex items-center gap-1 ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleUpdateTodo(todo.id, { status: getNextStatus(todo.status) })}
                              className="text-xs p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="次の段階に移動"
                            >
                              {status !== 'DONE' ? '→' : '↻'}
                            </button>
                            <button
                              onClick={() => setEditingTodo(todo)}
                              className="text-xs p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="編集"
                            >
                              ✏️
                            </button>
                          </div>
                        </div>

                        {todo.description && (
                          <div className={`text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 ${
                            status === 'DONE' ? 'line-through' : ''
                          }`}>
                            {todo.description}
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              todo.priority === 'URGENT' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                              todo.priority === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                              todo.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            }`}>
                              {todo.priority === 'URGENT' ? '🔥' : todo.priority === 'HIGH' ? '⚡' : todo.priority === 'MEDIUM' ? '⭐' : '📝'} {PRIORITY_LABELS[todo.priority]}
                            </span>
                            {todo.category && (
                              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 rounded-full">
                                📂 {todo.category}
                              </span>
                            )}
                          </div>

                          {todo.dueDate && (
                            <div className={`text-xs flex items-center gap-1 ${
                              isOverdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {isOverdue ? '🚨' : '📅'}
                              {format(todo.dueDate, 'M/d HH:mm', { locale: ja })}
                              {isOverdue && ' (期限切れ)'}
                            </div>
                          )}

                          {todo.tags && todo.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {todo.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                              {todo.tags.length > 3 && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  +{todo.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <span>更新: {format(todo.updatedAt, 'M/d', { locale: ja })}</span>
                            <span className="font-mono">#{String(todo.id).slice(-6)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                }

                {columnTodos.length === 0 && (
                  <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOverColumn === status
                      ? `border-${color}-400 bg-${color}-100 dark:bg-${color}-900/40`
                      : `border-${color}-300 dark:border-${color}-600`
                  }`}>
                    <div className={`text-${color}-400 dark:text-${color}-500 text-sm`}>
                      {draggedTodo ? (
                        <>
                          <div className="text-lg mb-2">⬇️</div>
                          <div>ここにドロップ</div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg mb-2">📝</div>
                          <div>まだタスクがありません</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
