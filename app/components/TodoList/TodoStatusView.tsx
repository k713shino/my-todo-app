'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import type { Todo } from '@/types/todo'

interface TodoStatusViewProps {
  filteredTodos: Todo[]
  sortTodos: (todos: Todo[]) => Todo[]
  setEditingTodo: (todo: Todo) => void
}

/**
 * Todoステータス別表示コンポーネント
 */
export default function TodoStatusView({
  filteredTodos,
  sortTodos,
  setEditingTodo,
}: TodoStatusViewProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        📊 ステータス別統計表示
      </h3>

      {/* 統計サマリー */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { status: 'TODO' as Status, label: '📝 未着手', bgColor: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-300' },
          { status: 'IN_PROGRESS' as Status, label: '🔄 作業中', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-300' },
          { status: 'REVIEW' as Status, label: '👀 確認中', bgColor: 'bg-orange-100', textColor: 'text-orange-800', borderColor: 'border-orange-300' },
          { status: 'DONE' as Status, label: '✅ 完了', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-300' },
        ].map(({ status, label, bgColor, textColor, borderColor }) => {
          const count = filteredTodos.filter(t => t.status === status).length
          const percentage = filteredTodos.length > 0 ? Math.round((count / filteredTodos.length) * 100) : 0
          return (
            <div key={status} className={`${bgColor} dark:bg-gray-800 rounded-lg p-4 border ${borderColor} dark:border-gray-600`}>
              <div className={`font-semibold ${textColor} dark:text-gray-200 text-lg`}>
                {count}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                ({percentage}%)
              </div>
            </div>
          )
        })}
      </div>

      {/* プログレスバー */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">進捗状況</h4>
        <div className="space-y-3">
          {[
            { status: 'TODO' as Status, label: '未着手', color: 'gray' },
            { status: 'IN_PROGRESS' as Status, label: '作業中', color: 'blue' },
            { status: 'REVIEW' as Status, label: '確認中', color: 'orange' },
            { status: 'DONE' as Status, label: '完了', color: 'green' },
          ].map(({ status, label, color }) => {
            const count = filteredTodos.filter(t => t.status === status).length
            const percentage = filteredTodos.length > 0 ? (count / filteredTodos.length) * 100 : 0
            return (
              <div key={status} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-600 dark:text-gray-400">
                  {label}
                </div>
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      color === 'gray' ? 'bg-gray-400' :
                      color === 'blue' ? 'bg-blue-500' :
                      color === 'orange' ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-xs text-gray-600 dark:text-gray-400 text-right">
                  {count}件
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 簡易リスト表示 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">最近のアクティビティ（最新5件）</h4>
        <div className="space-y-2">
          {sortTodos(filteredTodos).slice(0, 5).map(todo => (
            <div key={todo.id} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
              <div className={`w-3 h-3 rounded-full ${
                todo.status === 'TODO' ? 'bg-gray-400' :
                todo.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                todo.status === 'REVIEW' ? 'bg-orange-500' :
                'bg-green-500'
              }`} />
              <div
                className={`flex-1 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 ${
                  todo.status === 'DONE' ? 'line-through opacity-75' : ''
                }`}
                onClick={() => setEditingTodo(todo)}
              >
                <div className="font-medium text-sm">{todo.title}</div>
                {todo.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                    {todo.description}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {format(todo.updatedAt, 'M/d', { locale: ja })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
