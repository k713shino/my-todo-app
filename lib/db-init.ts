import { prisma } from '@/lib/prisma'

// データベース初期化の確認とTimeEntryテーブルの存在チェック
export async function ensureTimeEntrySchema(): Promise<boolean> {
  try {
    console.log('🔍 Checking TimeEntry schema...')
    
    // TimeEntryテーブルの存在確認
    const result = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'time_entries'
      ) as table_exists
    ` as Array<{ table_exists: boolean }>

    const tableExists = result[0]?.table_exists || false
    console.log('TimeEntry table exists:', tableExists)

    if (!tableExists) {
      console.error('❌ TimeEntry table does not exist. Run migrations first.')
      return false
    }

    // 簡単な読み取りテスト
    await prisma.timeEntry.findFirst({
      where: { id: 'non-existent' }
    })

    console.log('✅ TimeEntry schema is ready')
    return true
  } catch (error) {
    console.error('❌ TimeEntry schema check failed:', error)
    return false
  }
}

// データベース接続とスキーマの健全性チェック
export async function healthCheck(): Promise<{
  connected: boolean
  schemaReady: boolean
  error?: string
}> {
  try {
    // 基本接続テスト
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connected')

    // スキーマチェック
    const schemaReady = await ensureTimeEntrySchema()

    return {
      connected: true,
      schemaReady,
    }
  } catch (error) {
    console.error('❌ Database health check failed:', error)
    return {
      connected: false,
      schemaReady: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}