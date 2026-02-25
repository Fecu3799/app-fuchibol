import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getMatchAuditLogs } from './matchesClient';
import type { AuditLogEntry, GetMatchAuditLogsResponse } from '../../types/api';

export interface UseMatchAuditLogsResult {
  entries: AuditLogEntry[];
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  isLoading: boolean;
}

export function useMatchAuditLogs(matchId: string, options?: { enabled?: boolean }): UseMatchAuditLogsResult {
  const { token } = useAuth();

  const query = useInfiniteQuery({
    queryKey: ['match-audit-logs', matchId],
    queryFn: ({ pageParam = 1 }) =>
      getMatchAuditLogs(token!, matchId, { page: pageParam as number, pageSize: 20 }),
    enabled: !!token && (options?.enabled ?? true),
    initialPageParam: 1,
    getNextPageParam: (last: GetMatchAuditLogsResponse) =>
      last.pageInfo.hasNextPage ? last.pageInfo.page + 1 : undefined,
  });

  const entries = query.data?.pages.flatMap((p) => p.items) ?? [];

  return {
    entries,
    hasNextPage: query.hasNextPage,
    fetchNextPage: () => { void query.fetchNextPage(); },
    isFetchingNextPage: query.isFetchingNextPage,
    isLoading: query.isLoading,
  };
}
