import { useEffect } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ApiError } from './api';

/**
 * Watches a query result for 401 errors and triggers logout.
 * Call this in any screen that uses authenticated queries.
 */
export function useLogoutOn401(query: UseQueryResult<unknown, Error>) {
  const { logout } = useAuth();

  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      logout();
    }
  }, [query.error, logout]);
}
