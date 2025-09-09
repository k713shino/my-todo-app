import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession, isAuthenticated } from '@/lib/session-utils'
import { redis } from '@/lib/redis'

// 時間目標の設定・取得・更新
export async function GET(_request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const goalKey = `time:goals:${userId}`

    try {
      await redis.ping()
    } catch (pingError) {
      console.error('❌ Redis ping failed:', pingError)
      return NextResponse.json({ 
        dailyGoal: 480, // デフォルト8時間
        weeklyGoal: 2400, // デフォルト40時間
        fallback: true 
      })
    }

    const goals = await redis.get(goalKey)
    if (goals) {
      return NextResponse.json(JSON.parse(goals))
    }

    // デフォルト目標
    const defaultGoals = {
      dailyGoal: 480, // 8時間（分）
      weeklyGoal: 2400, // 40時間（分）
      notifications: {
        dailyReminder: true,
        progressAlert: true,
        goalAchieved: true
      },
      targets: {
        dailyTarget: 480,
        weeklyTarget: 2400,
        monthlyTarget: 9600 // 160時間
      }
    }

    return NextResponse.json(defaultGoals)
  } catch (error) {
    console.error('❌ GET GOALS API ERROR:', error)
    return NextResponse.json({ error: 'Goals unavailable' })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const goalKey = `time:goals:${userId}`
    const body = await request.json()

    const {
      dailyGoal = 480,
      weeklyGoal = 2400,
      notifications = {
        dailyReminder: true,
        progressAlert: true,
        goalAchieved: true
      }
    } = body

    // 目標を分単位に正規化
    const goals = {
      dailyGoal: Math.max(30, Math.min(1440, dailyGoal)), // 30分-24時間の範囲
      weeklyGoal: Math.max(120, Math.min(10080, weeklyGoal)), // 2時間-168時間の範囲
      notifications,
      targets: {
        dailyTarget: dailyGoal,
        weeklyTarget: weeklyGoal,
        monthlyTarget: weeklyGoal * 4
      },
      updatedAt: new Date().toISOString()
    }

    try {
      await redis.ping()
      await redis.set(goalKey, JSON.stringify(goals))
      await redis.expire(goalKey, 86400 * 365) // 1年間保持
    } catch (redisError) {
      console.error('❌ Redis save failed:', redisError)
      // Redis失敗時もクライアントには成功を返す（ローカルストレージにフォールバック）
    }

    return NextResponse.json({ success: true, goals })
  } catch (error) {
    console.error('❌ POST GOALS API ERROR:', error)
    return NextResponse.json({ error: 'Failed to save goals' }, { status: 500 })
  }
}

// 進捗チェックAPI
export async function PUT(request: NextRequest) {
  try {
    const session = await getAuthSession()
    if (!isAuthenticated(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { type } = await request.json() // 'daily' or 'weekly'

    try {
      await redis.ping()
    } catch (pingError) {
      return NextResponse.json({ progress: 0, achieved: false, fallback: true })
    }

    const now = new Date()
    let currentSeconds = 0
    // デフォルト目標（分）: 日次=480分(8h), 週次=2400分(40h) を秒に換算
    let targetSeconds = 0

    if (type === 'daily') {
      targetSeconds = 480 * 60
      const dayKey = `time:sum:day:${userId}:${formatDate(now)}`
      const dayStr = await redis.get(dayKey)
      currentSeconds = parseInt(dayStr || '0', 10)
      
      // 目標取得
      const goalKey = `time:goals:${userId}`
      const goalsStr = await redis.get(goalKey)
      if (goalsStr) {
        const goals = JSON.parse(goalsStr)
        targetSeconds = goals.dailyGoal * 60
      }
    } else if (type === 'weekly') {
      targetSeconds = 2400 * 60
      const weekKey = `time:sum:week:${userId}:${formatDate(startOfWeek(now))}`
      const weekStr = await redis.get(weekKey)
      currentSeconds = parseInt(weekStr || '0', 10)
      
      // 目標取得
      const goalKey = `time:goals:${userId}`
      const goalsStr = await redis.get(goalKey)
      if (goalsStr) {
        const goals = JSON.parse(goalsStr)
        targetSeconds = goals.weeklyGoal * 60
      }
    }

    const progress = targetSeconds > 0 ? Math.min(100, (currentSeconds / targetSeconds) * 100) : 0
    const achieved = progress >= 100

    return NextResponse.json({
      progress: Math.round(progress),
      achieved,
      currentSeconds,
      targetSeconds,
      remainingSeconds: Math.max(0, targetSeconds - currentSeconds)
    })
  } catch (error) {
    console.error('❌ PUT PROGRESS API ERROR:', error)
    return NextResponse.json({ progress: 0, achieved: false, error: 'Progress check failed' })
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function startOfWeek(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const offset = (day + 6) % 7 // 月曜日始まり
  x.setDate(x.getDate() - offset)
  return x
}
