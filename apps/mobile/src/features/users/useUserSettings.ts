import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserSettings, patchUserSettings } from './settingsClient';
import type { UserSettings } from '../../types/api';

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: getUserSettings,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => patchUserSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['user-settings'] });
      const prev = queryClient.getQueryData<UserSettings>(['user-settings']);
      queryClient.setQueryData<UserSettings>(['user-settings'], (old) =>
        old ? { ...old, ...patch } : undefined,
      );
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['user-settings'], ctx.prev);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['user-settings'] });
    },
  });
}
