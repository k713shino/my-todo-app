interface RateLimitOptions {
  interval: number
  uniqueTokenPerInterval: number
}

interface RateLimitResult {
  success: boolean
  remaining?: number
  reset?: number
}

export default function rateLimit(options: RateLimitOptions) {
  const tokenCache = new Map()

  return {
    check: async (limit: number, token: string): Promise<RateLimitResult> => {
      const tokenCount = tokenCache.get(token) || [0, Date.now()]
      const [count, lastReset] = tokenCount
      const now = Date.now()
      const timePassed = now - lastReset

      if (timePassed > options.interval) {
        tokenCache.set(token, [1, now])
        return { success: true, remaining: limit - 1, reset: now + options.interval }
      }

      if (count >= limit) {
        return { success: false, remaining: 0, reset: lastReset + options.interval }
      }

      tokenCache.set(token, [count + 1, lastReset])
      return { success: true, remaining: limit - count - 1, reset: lastReset + options.interval }
    },
  }
}