"use client"

import { useMemo, useState } from 'react'
import { TodoStats } from '@/types/todo'

type Variant = 'color' | 'neutral' | 'compact'

interface TodoStatsDisplayProps {
  stats: TodoStats
  variant?: Variant
  // 右上の更新時刻を表示するか
  showTimestamp?: boolean
  // 表示するタイムゾーン（例: 'Asia/Tokyo'）。未指定ならローカルタイムゾーン
  timeZone?: string
}

export default function TodoStatsDisplay({ stats, variant = 'color', showTimestamp = true, timeZone }: TodoStatsDisplayProps) {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const weekly = stats.weeklyDone ?? 0
  const monthly = stats.monthlyDone ?? 0
  const maxBar = Math.max(weekly, monthly, 1)
  const lastUpdatedRaw = (stats as any)?.lastUpdated as string | undefined

  const formattedUpdated = (() => {
    if (!lastUpdatedRaw) return undefined
    try {
      const d = new Date(lastUpdatedRaw)
      const formatter = new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, timeZone: timeZone || undefined
      })
      return formatter.format(d)
    } catch {
      return lastUpdatedRaw
    }
  })()

  // カテゴリ分布（円グラフ用データ作成）
  const categoryEntries = (() => {
    const entries = (Object.entries(stats.categoryBreakdown || {}) as Array<[string, number]>)
      .filter(([_, c]) => Number(c) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
    if (entries.length <= 7) return entries
    const top = entries.slice(0, 6)
    const restCount = entries.slice(6).reduce((sum, [, c]) => sum + Number(c), 0)
    return [...top, ['その他', restCount]]
  })()

  const categoryTotal = categoryEntries.reduce((sum, [, c]) => sum + Number(c), 0)
  const palette = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6']
  const categorySegments = (() => {
    let acc = 0
    return categoryEntries.map(([name, count], i) => {
      const start = (acc / Math.max(1, categoryTotal)) * 100
      acc += Number(count)
      const end = (acc / Math.max(1, categoryTotal)) * 100
      return { name, count: Number(count), start, end, color: palette[i % palette.length] }
    })
  })()

  // 優先度棒グラフ用データ（件数降順でソート）
  const priorityBars = [
    { key: 'URGENT', label: '緊急', color: '#ef4444', value: stats.byPriority.urgent },
    { key: 'HIGH', label: '高', color: '#f97316', value: stats.byPriority.high },
    { key: 'MEDIUM', label: '中', color: '#f59e0b', value: stats.byPriority.medium },
    { key: 'LOW', label: '低', color: '#10b981', value: stats.byPriority.low },
  ].sort((a, b) => b.value - a.value)
  const priorityMax = Math.max(...priorityBars.map(b => b.value), 1)
  const [showPercent, setShowPercent] = useState(false)

  // 折れ線グラフ（週次/月次切替）
  const [trendMode, setTrendMode] = useState<'weekly'|'monthly'>('weekly')
  const trend = useMemo(() => {
    if (trendMode === 'monthly') return (stats.monthlyTrend || []).slice(-6)
    return (stats.weeklyTrend || []).slice(-8)
  }, [trendMode, stats.weeklyTrend, stats.monthlyTrend])
  const trendMax = Math.max(...trend.map(t => t.count), 1)
  const w = 260, h = 80, pad = 6
  const points = trend.length > 0
    ? trend.map((t, i) => {
        const x = pad + (i * (w - pad*2)) / Math.max(1, trend.length - 1)
        const y = h - pad - (t.count / trendMax) * (h - pad*2)
        return `${x},${y}`
      }).join(' ')
    : ''
  const trendLabelStep = trend.length > 10 ? Math.ceil(trend.length / 8) : 1

  if (variant === 'compact') {
    // コンパクト: ダッシュボードの小カードと同じサイズ感で4指標のみ
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">合計</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.active}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">未完了</div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">期限切れ</div>
          </div>
        </div>
      </div>
    )
  }

  const wrapperClass =
    variant === 'neutral'
      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700'
      : 'bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-600 dark:to-pink-600 text-white p-6 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-purple-400/20 dark:border-purple-500/30'
  const mutedText = variant === 'neutral' ? 'text-gray-500 dark:text-gray-400' : 'text-white/90 dark:text-white/80'
  const cardBg = variant === 'neutral' ? 'bg-gray-50 dark:bg-gray-900/40' : 'bg-white/20 dark:bg-white/15'
  const barBase = variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/30 dark:bg-white/20'

  return (
    <div className={wrapperClass}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={`text-xl font-bold ${variant === 'neutral' ? 'text-gray-900 dark:text-white' : 'text-white'}`}>📊 あなたのTodo統計</h2>
        {showTimestamp && formattedUpdated && (
          <span className={`text-xs ${mutedText}`}>更新: {formattedUpdated}{timeZone ? ` (${timeZone})` : ''}</span>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-gray-900 dark:text-white' : 'text-white'}`}>{stats.total}</div>
          <div className={`text-sm ${mutedText}`}>総数</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-green-600 dark:text-green-300' : 'text-green-300 dark:text-green-200'}`}>{stats.completed}</div>
          <div className={`text-sm ${mutedText}`}>完了</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-yellow-600 dark:text-yellow-300' : 'text-yellow-300 dark:text-yellow-200'}`}>{stats.active}</div>
          <div className={`text-sm ${mutedText}`}>未完了</div>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${variant === 'neutral' ? 'text-red-600 dark:text-red-300' : 'text-red-300 dark:text-red-200'}`}>{stats.overdue}</div>
          <div className={`text-sm ${mutedText}`}>期限切れ</div>
        </div>
      </div>

      {/* 完了率 */}
      <div className="mb-4">
        <div className={`flex justify-between text-sm mb-1 ${variant === 'neutral' ? 'text-gray-700 dark:text-gray-200' : 'text-white'}`}>
          <span>完了率</span>
          <span>{completionRate}%</span>
        </div>
        <div className={`w-full ${barBase} rounded-full h-2`}>
          <div className={`${variant === 'neutral' ? 'bg-green-500 dark:bg-green-400' : 'bg-green-300 dark:bg-green-400'} h-2 rounded-full transition-all duration-500`} style={{ width: `${completionRate}%` }} />
        </div>
      </div>

      {/* 優先度別統計 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 棒グラフ */}
        <div className={`${cardBg} rounded p-3`}>
          <div className={`flex items-center justify-between mb-2`}>
            <div className={`text-sm ${mutedText}`}>優先度別分布</div>
            <button
              className={`text-[11px] px-2 py-0.5 rounded ${variant==='neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/20'} ${mutedText}`}
              onClick={(e) => { e.preventDefault(); setShowPercent(p => !p) }}
              title={showPercent ? '件数表示に切替' : '割合表示に切替'}
            >{showPercent ? '％' : '#'} 表示</button>
          </div>
          <div className="space-y-2">
            {priorityBars.map(b => (
              <div key={b.key} className="flex items-center gap-2 text-xs">
                <div className="w-10 text-right pr-1" style={{ color: b.color }} title={`${b.label}: ${b.value}件 (${Math.round((b.value/Math.max(1, stats.total))*100)}%)`}>{b.label}</div>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded" title={`${b.label}: ${b.value}件 (${Math.round((b.value/Math.max(1, stats.total))*100)}%)`}>
                  <div className="h-2 rounded" style={{ width: `${showPercent ? Math.round((b.value/Math.max(1, stats.total))*100) : Math.round((b.value/priorityMax)*100)}%`, backgroundColor: b.color }} />
                </div>
                <div className={`${mutedText} w-10 text-right font-mono`}>
                  {showPercent ? `${Math.round((b.value/Math.max(1, stats.total))*100)}%` : b.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 折れ線グラフ */}
        <div className={`${cardBg} rounded p-3`}>
          <div className={`text-sm mb-2 ${mutedText} flex items-center justify-between`}>
            <span>{trendMode === 'monthly' ? '月次完了推移' : '週次完了推移'}</span>
            <div className="flex gap-1 text-xs">
              <button onClick={() => setTrendMode('weekly')} className={`px-2 py-0.5 rounded ${trendMode==='weekly' ? 'bg-purple-600 text-white' : `${mutedText} bg-transparent border border-gray-300 dark:border-gray-600`}`}>週</button>
              <button onClick={() => setTrendMode('monthly')} className={`px-2 py-0.5 rounded ${trendMode==='monthly' ? 'bg-purple-600 text-white' : `${mutedText} bg-transparent border border-gray-300 dark:border-gray-600`}`}>月</button>
            </div>
          </div>
          <div className="space-y-2">
            <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full h-28 overflow-visible">
              {/* 横グリッド（3本） */}
              {[0.25, 0.5, 0.75].map((p, i) => (
                <line key={i} x1={pad} y1={pad + (h - pad*2) * p} x2={w-pad} y2={pad + (h - pad*2) * p} stroke={variant==='neutral' ? '#e5e7eb' : 'rgba(255,255,255,0.25)'} strokeWidth={0.5} />
              ))}
              {/* 軸 */}
              <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke={variant==='neutral' ? '#9ca3af' : 'rgba(255,255,255,0.6)'} strokeWidth={0.75} />
              <line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke={variant==='neutral' ? '#9ca3af' : 'rgba(255,255,255,0.6)'} strokeWidth={0.75} />
              {/* 折れ線 */}
              {points && (
                <polyline points={points} fill="none" stroke={variant==='neutral' ? '#8b5cf6' : '#ffffff'} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {/* データ点 */}
              {trend.map((t, i) => {
                const x = pad + (i * (w - pad*2)) / Math.max(1, trend.length - 1)
                const y = h - pad - (t.count / trendMax) * (h - pad*2)
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r={3} fill={variant==='neutral' ? '#8b5cf6' : '#ffffff'}>
                      <title>{`${t.label}: ${t.count}件`}</title>
                    </circle>
                    {/* ラベル（SVG内・点と同じxに配置） */}
                    {(i % trendLabelStep === 0 || i === trend.length - 1) && (
                      <text x={x} y={h - pad + 12} textAnchor="middle" fontSize="9" className="fill-current" style={{ fill: variant==='neutral' ? '#9ca3af' : 'rgba(255,255,255,0.8)' }}>
                        {t.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* 週次集計の基準表記 */}
      {stats.trendMeta && (
        <div className={`mt-2 text-[11px] ${mutedText}`}>週次基準: {stats.trendMeta.weeks}週・{stats.trendMeta.weekStart === 'mon' ? '月曜' : '日曜'}開始・{stats.trendMeta.tz === 'UTC' ? 'UTC' : 'ローカル'} 時間</div>
      )}

      {/* カテゴリ分布（円グラフ） */}
      {categoryTotal > 0 && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div className="md:col-span-1 flex items-center justify-center">
            <div
              className="relative w-40 h-40 rounded-full"
              style={{
                background: `conic-gradient(${categorySegments.map(seg => `${seg.color} ${seg.start}% ${seg.end}%`).join(', ')})`
              }}
              aria-label="カテゴリ分布"
              role="img"
            >
              <div className={`absolute inset-4 ${variant === 'neutral' ? 'bg-white dark:bg-gray-800' : 'bg-white/80'} rounded-full flex items-center justify-center`}> 
                <div className={`text-center ${variant === 'neutral' ? 'text-gray-800 dark:text-gray-100' : 'text-gray-800'}`}>
                  <div className="text-xs">カテゴリ</div>
                  <div className="text-lg font-bold">{categoryTotal}</div>
                </div>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {categorySegments.map((seg) => (
                <div key={seg.name} className={`${cardBg} rounded p-2 flex items-center justify-between`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: seg.color }} />
                    <span className={`truncate ${variant === 'neutral' ? 'text-gray-800 dark:text-gray-200' : 'text-white'}`}>{seg.name}</span>
                  </div>
                  <div className={`flex items-center gap-2 ${variant === 'neutral' ? 'text-gray-700 dark:text-gray-300' : 'text-white/90'}`}>
                    <span className="font-mono">{seg.count}</span>
                    <span className={`${mutedText}`}>{Math.round((seg.count / Math.max(1, categoryTotal)) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 期間別（直近）完了数 */}
      <div className="mt-4">
        <div className={`text-sm mb-2 ${mutedText}`}>⏱ 期間別の完了数</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className={`${cardBg} rounded p-3`}>
            <div className={`flex justify-between mb-1 ${mutedText}`}>
              <span>直近1週間</span>
              <span className="font-semibold">{weekly}</span>
            </div>
            <div className={`w-full h-2 ${variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/25'} rounded`} aria-label={`直近1週間の完了数 ${weekly}`}>
              <div className={`h-2 rounded ${variant === 'neutral' ? 'bg-green-500 dark:bg-green-400' : 'bg-green-300'}`} style={{ width: `${Math.round((weekly / maxBar) * 100)}%` }} />
            </div>
          </div>
          <div className={`${cardBg} rounded p-3`}>
            <div className={`flex justify-between mb-1 ${mutedText}`}>
              <span>直近1ヶ月</span>
              <span className="font-semibold">{monthly}</span>
            </div>
            <div className={`w-full h-2 ${variant === 'neutral' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/25'} rounded`} aria-label={`直近1ヶ月の完了数 ${monthly}`}>
              <div className={`h-2 rounded ${variant === 'neutral' ? 'bg-blue-500 dark:bg-blue-400' : 'bg-blue-300'}`} style={{ width: `${Math.round((monthly / maxBar) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
