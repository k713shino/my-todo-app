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