import { NextRequest, NextResponse } from 'next/server'
import { lambdaAPI } from '@/lib/lambda-api'

export async function GET() {
  try {
    console.log('🔍 Lambda endpoints diagnostic started')
    
    // Lambda関数のヘルスチェックとエンドポイント一覧を取得
    const response = await lambdaAPI.get('/')
    
    console.log('🔍 Lambda endpoints response:', response)
    
    return NextResponse.json({
      success: true,
      lambdaResponse: response,
      availableEndpoints: response.data?.availableEndpoints || [],
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Lambda endpoints diagnostic error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}