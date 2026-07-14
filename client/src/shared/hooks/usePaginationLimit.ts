import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SetStateAction } from 'react';

const STORAGE_KEY = 'enrollpro_pagination_limit';

export function usePaginationLimit(defaultLimit: number = 50) {
  const [limit, setLimitState] = useState<number>(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      return item ? Number(item) : defaultLimit;
    } catch (error) {
      console.warn('Error reading localStorage for pagination limit', error);
      return defaultLimit;
    }
  });

  const setLimit = useCallback((newLimit: SetStateAction<number>) => {
    setLimitState((prev) => {
      try {
        const limitToSet = typeof newLimit === 'function' ? (newLimit as (prev: number) => number)(prev) : newLimit;
        window.localStorage.setItem(STORAGE_KEY, String(limitToSet));
        return limitToSet;
      } catch (error) {
        console.warn('Error setting localStorage for pagination limit', error);
        return typeof newLimit === 'function' ? (newLimit as (prev: number) => number)(prev) : newLimit;
      }
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setLimitState(Number(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return useMemo(() => [limit, setLimit] as const, [limit, setLimit]);
}
