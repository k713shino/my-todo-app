import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const lambdaApiUrl = process.env.LAMBDA_API_URL
    
    if (!lambdaApiUrl) {
      return NextResponse.json({
        error: 'LAMBDA_API_URL not configured',
        env: {
          NODE_ENV: process.env.NODE_ENV,
          VERCEL: process.env.VERCEL,
          hasLambdaUrl: !!lambdaApiUrl
        }
      }, { status: 500 })
    }

    // Lambda APIヘルスチェック
    const response = await fetch(`${lambdaApiUrl}/`)
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      lambdaApiUrl: lambdaApiUrl,
      lambdaResponse: data,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        hasLambdaUrl: !!lambdaApiUrl
      }
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Lambda API test failed',
      details: error instanceof Error ? error.message : String(error),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: !!process.env.VERCEL,
        hasLambdaUrl: !!process.env.LAMBDA_API_URL
      }
    }, { status: 500 })
  }
}
