'use client'

import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Status } from '@prisma/client'
import type { Todo } from '@/types/todo'

interface TodoCalendarViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  filteredTodos: Todo[]
  setEditingTodo: (todo: Todo) => void
}

const isCompleted = (status: Status): boolean => status === 'DONE'

/**
 * カレンダー用ヘルパー関数
 */
const getCalendarDays = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  const endDate = new Date(lastDayOfMonth)
  endDate.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()))

  const days = []
  const currentDateLoop = new Date(startDate)

  while (currentDateLoop <= endDate) {
    days.push(new Date(currentDateLoop))
    currentDateLoop.setDate(currentDateLoop.getDate() + 1)
  }

  return days
}

/**
 * Todoカレンダー表示コンポーネント
 */
export default function TodoCalendarView({
  currentDate,
  setCurrentDate,
  filteredTodos,
  setEditingTodo,
}: TodoCalendarViewProps) {
  const getTodosForDate = (date: Date) => {
    return filteredTodos.filter(todo => {
      if (!todo.dueDate) return false
      const todoDate = new Date(todo.dueDate)
      return todoDate.toDateString() === date.toDateString()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          📅 カレンダー表示
        </h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ←
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[120px] text-center">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </span>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            →
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-700">
          {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-medium ${
                index === 0 ? 'text-red-600 dark:text-red-400' :
                index === 6 ? 'text-blue-600 dark:text-blue-400' :
                'text-gray-700 dark:text-gray-300'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* カレンダー日付 */}
        <div className="grid grid-cols-7">
          {getCalendarDays(currentDate).map((date, index) => {
            const todosForDate = getTodosForDate(date)
            const isCurrentMonth = date.getMonth() === currentDate.getMonth()
            const isToday = date.toDateString() === new Date().toDateString()
            const isWeekend = date.getDay() === 0 || date.getDay() === 6

            return (
              <div
                key={index}
                className={`min-h-[120px] p-2 border-r border-b border-gray-200 dark:border-gray-700 ${
                  !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                } ${
                  isToday ? 'ring-2 ring-purple-500 ring-inset' : ''
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  !isCurrentMonth ? 'text-gray-400 dark:text-gray-600' :
                  isToday ? 'text-purple-600 dark:text-purple-400' :
                  isWeekend ? 'text-red-600 dark:text-red-400' :
                  'text-gray-900 dark:text-gray-100'
                }`}>
                  {date.getDate()}
                </div>

                {/* その日のTodo */}
                <div className="space-y-1">
                  {todosForDate.slice(0, 3).map((todo) => (
                    <div
                      key={todo.id}
                      className={`text-xs p-1 rounded cursor-pointer hover:shadow-sm transition-shadow ${
                        isCompleted(todo.status)
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 line-through opacity-75'
                          : todo.priority === 'URGENT'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                          : todo.priority === 'HIGH'
                          ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      }`}
                      onClick={() => setEditingTodo(todo)}
                      title={todo.description || todo.title}
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{todo.title}</span>
                      </div>
                    </div>
                  ))}
                  {todosForDate.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      +{todosForDate.length - 3}件
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
