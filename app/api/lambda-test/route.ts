import { NextRequest, NextResponse } from 'next/server';
import { lambdaAPI, formatLambdaAPIError } from '@/lib/lambda-api';
import type { VercelAPIResponse, RDSConnectionResponse } from '@/types/lambda-api';

export async function GET(request: NextRequest): Promise<NextResponse<VercelAPIResponse<RDSConnectionResponse>>> {
  try {
    console.log('🚀 Lambda API テスト開始...');
    
    // Lambda API経由でRDS接続テスト
    const result = await lambdaAPI.testConnection();
    
    console.log('✅ Lambda API接続成功:', result);
    
    const response: VercelAPIResponse<RDSConnectionResponse> = {
      success: true,
      message: 'Lambda API経由でRDS接続成功！',
      lambdaResponse: result,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Lambda API呼び出しエラー:', error);
    
    const errorResponse: VercelAPIResponse = {
      success: false,
      error: formatLambdaAPIError(error),
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// OPTIONS メソッドでCORS対応
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}