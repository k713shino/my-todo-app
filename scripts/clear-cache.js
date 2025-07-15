async function clearCache() {
  try {
    console.log('🧹 キャッシュをクリア中...')
    
    const args = process.argv.slice(2)
    const pattern = args[0] || '*'
    
    if (pattern === 'all') {
      await redis.flushdb()
      console.log('✅ 全キャッシュをクリアしました')
    } else {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
        console.log(`✅ ${keys.length}個のキーをクリアしました`)
      } else {
        console.log('🤷 該当するキーが見つかりませんでした')
      }
    }
  } catch (error) {
    console.error('❌ キャッシュクリアエラー:', error)
  } finally {
    await redis.quit()
  }
}

// 実行判定
if (require.main === module) {
  const command = process.argv[2]
  if (command === 'clear') {
    clearCache()
  } else {
    getCacheStats()
  }
}