"use client";

import React, { useState, useCallback } from 'react';
import type { 
  LambdaConnectionTestProps, 
  VercelAPIResponse, 
  RDSConnectionResponse,
  LambdaAPIError 
} from '@/types/lambda-api';

interface TestResult {
  type: 'vercel' | 'direct';
  data: VercelAPIResponse<RDSConnectionResponse> | RDSConnectionResponse;
  timestamp: string;
}

const LambdaConnectionTest: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown, context: string) => {
    let errorMessage: string;
    
    if (err instanceof Error) {
      errorMessage = `${context}: ${err.message}`;
    } else {
      errorMessage = `${context}: Unknown error occurred`;
    }
    
    console.error(errorMessage, err);
    setError(errorMessage);
  }, []);

  const handleSuccess = useCallback((data: any, type: 'vercel' | 'direct') => {
    const testResult: TestResult = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    
    setResult(testResult);
  }, []);

  const testLambdaConnection = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/lambda-test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VercelAPIResponse<RDSConnectionResponse> = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      handleSuccess(data, 'vercel');

    } catch (err) {
      handleError(err, 'Vercel API経由テスト失敗');
    } finally {
      setLoading(false);
    }
  };

  const testDirectLambda = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const lambdaURL = process.env.NEXT_PUBLIC_LAMBDA_API_URL || 
        'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod/';

      const response = await fetch(lambdaURL, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: RDSConnectionResponse = await response.json();
      handleSuccess(data, 'direct');

    } catch (err) {
      handleError(err, '直接Lambda API呼び出し失敗');
    } finally {
      setLoading(false);
    }
  };

  const formatDisplayData = (data: TestResult['data']): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const getStatusBadge = (type: TestResult['type']): React.ReactNode => {
    const badges = {
      vercel: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          📡 Vercel API経由
        </span>
      ),
      direct: (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          🚀 直接Lambda API
        </span>
      ),
    };
    
    return badges[type];
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 mb-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          🌸 Lambda RDS接続テスト
        </h2>
        <p className="text-sm text-gray-600">
          Lambda APIとRDSの接続状態をテストします
        </p>
      </div>
      
      <div className="space-y-3 mb-6">
        <button
          onClick={testLambdaConnection}
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          type="button"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              テスト中...
            </span>
          ) : (
            '📡 Vercel API経由テスト'
          )}
        </button>

        <button
          onClick={testDirectLambda}
          disabled={loading}
          className="w-full px-4 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          type="button"
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              テスト中...
            </span>
          ) : (
            '🚀 直接Lambda APIテスト'
          )}
        </button>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400 text-lg">❌</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                接続エラー
              </h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 成功結果表示 */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-green-400 text-lg">✅</span>
            </div>
            <div className="ml-3 w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-green-800">
                  接続成功！
                </h3>
                {getStatusBadge(result.type)}
              </div>
              
              <div className="mb-2">
                <p className="text-xs text-green-700">
                  テスト実行時刻: {new Date(result.timestamp).toLocaleString('ja-JP')}
                </p>
              </div>
              
              <div className="mt-3">
                <details className="group">
                  <summary className="text-sm font-medium text-green-800 cursor-pointer hover:text-green-900">
                    レスポンス詳細を表示
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-60 border">
                    {formatDisplayData(result.data)}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LambdaConnectionTest;