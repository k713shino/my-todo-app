import { NextResponse } from 'next/server';

interface LambdaResponse {
  success: boolean;
  message?: string;
  data?: any;
  timestamp?: string;
  error?: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    console.log('🚀 Lambda API呼び出し開始...');
    
    const response = await fetch('https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod/', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Lambda APIレスポンス:', data);

    const responseData: LambdaResponse = {
      success: true,
      message: 'Lambda経由でRDS接続成功！',
      data: data,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('❌ Lambda API呼び出しエラー:', error);
    
    const errorResponse: LambdaResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
