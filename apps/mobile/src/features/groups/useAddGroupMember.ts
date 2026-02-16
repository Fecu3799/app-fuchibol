import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { addGroupMember } from './groupsClient';

export function useAddGroupMember(groupId: string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (identifier: string) => addGroupMember(token!, groupId, identifier),
    onSuccess: (data) => {
      queryClient.setQueryData(['group', groupId], data);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
