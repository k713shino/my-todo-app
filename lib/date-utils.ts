import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, addDays } from 'date-fns'
import { ja } from 'date-fns/locale'

export type DateRangePreset = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month' | 'next_month' | 'overdue' | 'no_due_date'

export interface DateRange {
  start?: Date
  end?: Date
  isOverdue?: boolean
  isNoDueDate?: boolean
}

export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date()
  
  switch (preset) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now)
      }
    
    case 'tomorrow':
      const tomorrow = addDays(now, 1)
      return {
        start: startOfDay(tomorrow),
        end: endOfDay(tomorrow)
      }
    
    case 'this_week':
      return {
        start: startOfWeek(now, { locale: ja }),
        end: endOfWeek(now, { locale: ja })
      }
    
    case 'next_week':
      const nextWeek = addWeeks(now, 1)
      return {
        start: startOfWeek(nextWeek, { locale: ja }),
        end: endOfWeek(nextWeek, { locale: ja })
      }
    
    case 'this_month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now)
      }
    
    case 'next_month':
      const nextMonth = addMonths(now, 1)
      return {
        start: startOfMonth(nextMonth),
        end: endOfMonth(nextMonth)
      }
    
    case 'overdue':
      return {
        end: now,
        isOverdue: true
      }
    
    case 'no_due_date':
      return {
        isNoDueDate: true
      }
    
    default:
      return {}
  }
}

export const dateRangeLabels: Record<DateRangePreset, string> = {
  today: '今日',
  tomorrow: '明日',
  this_week: '今週',
  next_week: '来週', 
  this_month: '今月',
  next_month: '来月',
  overdue: '期限切れ',
  no_due_date: '期限なし'
}

/**
 * 安全な日付変換ユーティリティ
 * Lambda APIなどから返される不完全な日付データを安全に処理する
 */

/**
 * 安全に日付文字列をDateオブジェクトに変換する
 * 無効な日付の場合は現在時刻を返す
 */
export function safeParseDate(dateValue: any): Date {
  if (!dateValue) return new Date();
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return new Date();
    }
    return date;
  } catch {
    return new Date();
  }
}

/**
 * 安全に日付文字列をDateオブジェクトに変換する（null許可版）
 * 無効な日付の場合はnullを返す
 */
export function safeParseNullableDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}

/**
 * Todo型のレスポンスデータを安全に変換する
 */
export function safeParseTodoDate<T extends Record<string, any>>(todo: T): T & {
  createdAt: Date;
  updatedAt: Date;
  dueDate: Date | null;
} {
  return {
    ...todo,
    createdAt: safeParseDate(todo.createdAt),
    updatedAt: safeParseDate(todo.updatedAt),
    dueDate: safeParseNullableDate(todo.dueDate),
  };
}