import { useState, useCallback, useEffect } from 'react';
import type { 
  Todo, 
  CreateTodoRequest, 
  UpdateTodoRequest, 
  VercelAPIResponse,
  LambdaAPIError 
} from '@/types/lambda-api';

interface UseLambdaAPIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseLambdaAPIReturn<T> extends UseLambdaAPIState<T> {
  execute: (...args: any[]) => Promise<T | void>;
  reset: () => void;
}

// 汎用的なAPI呼び出しフック
export function useLambdaAPI<T = any>(
  apiCall: (...args: any[]) => Promise<T>
): UseLambdaAPIReturn<T> {
  const [state, setState] = useState<UseLambdaAPIState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (...args: any[]): Promise<T | void> => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiCall(...args);
      setState({ data: result, loading: false, error: null });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState({ data: null, loading: false, error: errorMessage });
      throw error;
    }
  }, [apiCall]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}

// Vercel API経由でのTodo操作フック
export function useTodos(userId?: string) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Todoリストを取得
  const fetchTodos = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const url = userId ? `/api/todos?userId=${userId}` : '/api/todos';
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VercelAPIResponse<Todo[]> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch todos');
      }

      setTodos(data.lambdaResponse || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Todo取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Todoを作成
  const createTodo = useCallback(async (todoData: CreateTodoRequest): Promise<Todo | null> => {
    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todoData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VercelAPIResponse<Todo> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create todo');
      }

      const newTodo = data.lambdaResponse!;
      setTodos(prev => [...prev, newTodo]);
      return newTodo;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Todo作成エラー:', err);
      return null;
    }
  }, []);

  // Todoを更新
  const updateTodo = useCallback(async (id: string, todoData: UpdateTodoRequest): Promise<Todo | null> => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(todoData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VercelAPIResponse<Todo> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update todo');
      }

      const updatedTodo = data.lambdaResponse!;
      setTodos(prev => prev.map(todo => todo.id === id ? updatedTodo : todo));
      return updatedTodo;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Todo更新エラー:', err);
      return null;
    }
  }, []);

  // Todoを削除
  const deleteTodo = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: VercelAPIResponse<{ success: boolean; message: string }> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete todo');
      }

      setTodos(prev => prev.filter(todo => todo.id !== id));
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Todo削除エラー:', err);
      return false;
    }
  }, []);

  // Todoの完了状態を切り替え
  const toggleTodoComplete = useCallback(async (id: string): Promise<Todo | null> => {
    const todo = todos.find(t => t.id === id);
    if (!todo) return null;

    return await updateTodo(id, { completed: !todo.completed });
  }, [todos, updateTodo]);

  // 初回ロード
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  return {
    todos,
    loading,
    error,
    fetchTodos,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodoComplete,
  };
}

// Lambda接続テスト用フック
export function useLambdaConnectionTest() {
  const [testResult, setTestResult] = useState<{
    success: boolean;
    data?: any;
    error?: string;
    timestamp: string;
  } | null>(null);

  const testVercelAPI = useLambdaAPI(async () => {
    const response = await fetch('/api/lambda-test');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });

  const testDirectLambda = useLambdaAPI(async () => {
    const lambdaURL = process.env.NEXT_PUBLIC_LAMBDA_API_URL || 
      'https://wmo3ty4ngk.execute-api.ap-northeast-1.amazonaws.com/prod/';
    
    const response = await fetch(lambdaURL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  });

  const runTest = useCallback(async (type: 'vercel' | 'direct') => {
    setTestResult(null);
    
    try {
      let result;
      if (type === 'vercel') {
        result = await testVercelAPI.execute();
      } else {
        result = await testDirectLambda.execute();
      }

      setTestResult({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }, [testVercelAPI, testDirectLambda]);

  return {
    testResult,
    loading: testVercelAPI.loading || testDirectLambda.loading,
    error: testVercelAPI.error || testDirectLambda.error,
    runTest,
    resetTest: () => {
      setTestResult(null);
      testVercelAPI.reset();
      testDirectLambda.reset();
    },
  };
}