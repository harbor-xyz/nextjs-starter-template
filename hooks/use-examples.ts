// hooks/use-examples.ts
import { useState, useEffect, useCallback } from 'react';

interface Example {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'pending' | 'completed';
  createdAt: string;
}

interface UseExamplesReturn {
  examples: Example[];
  loading: boolean;
  error: string | null;
  createExample: (data: Omit<Example, 'id' | 'createdAt'>) => Promise<any>;
  updateExample: (id: string, data: Partial<Example>) => Promise<any>;
  deleteExample: (id: string) => Promise<any>;
}

export function useExamples(): UseExamplesReturn {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExamples = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/examples');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setExamples(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch examples');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExamples();
  }, [fetchExamples]);

  const createExample = async (data: Omit<Example, 'id' | 'createdAt'>) => {
    try {
      const response = await fetch('/api/examples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update local state with new example
      setExamples(prev => [...prev, result.example]);
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to create example');
      throw err;
    }
  };

  const updateExample = async (id: string, data: Partial<Example>) => {
    try {
      const response = await fetch(`/api/examples/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Update local state
      setExamples(prev => 
        prev.map(item => 
          item.id === id ? { ...item, ...result.example } : item
        )
      );
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to update example');
      throw err;
    }
  };

  const deleteExample = async (id: string) => {
    try {
      const response = await fetch(`/api/examples/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Remove from local state
      setExamples(prev => prev.filter(item => item.id !== id));
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to delete example');
      throw err;
    }
  };

  return {
    examples,
    loading,
    error,
    createExample,
    updateExample,
    deleteExample,
  };
}