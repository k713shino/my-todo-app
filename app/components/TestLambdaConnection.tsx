'use client';

import React, { useState } from 'react';

interface LambdaResponse {
  success: boolean;
  message?: string;
  data?: any;
  timestamp?: string;
  error?: string;
}

const TestLambdaConnection: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<LambdaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch('/api/test-lambda');
      const data: LambdaResponse = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP error! status: ${res.status}`);
      }
      
      setResponse(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4">Lambda¥šÆ¹È</h2>
      
      <button
        onClick={testConnection}
        disabled={isLoading}
        className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition-colors ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
        }`}
      >
        {isLoading ? '¥š-...' : 'Lambda¥šÆ¹È'}
      </button>

      {response && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800"> Ÿ</h3>
          <p className="text-sm text-green-700 mt-1">{response.message}</p>
          {response.timestamp && (
            <p className="text-xs text-green-600 mt-2">
              B;: {new Date(response.timestamp).toLocaleString('ja-JP')}
            </p>
          )}
          {response.data && (
            <details className="mt-2">
              <summary className="text-sm text-green-700 cursor-pointer">
                Çü¿’h:
              </summary>
              <pre className="text-xs bg-green-100 p-2 mt-1 rounded overflow-x-auto">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800">L ¨éü</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TestLambdaConnection;