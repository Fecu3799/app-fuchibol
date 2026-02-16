import { buildUrl, fetchJson } from '../../lib/api';
import type {
  CreateGroupResponse,
  GroupDetail,
  ListGroupsResponse,
} from '../../types/api';

export function getGroups(token: string): Promise<ListGroupsResponse> {
  return fetchJson<ListGroupsResponse>(buildUrl('/api/v1/groups'), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getGroup(token: string, groupId: string): Promise<GroupDetail> {
  return fetchJson<GroupDetail>(buildUrl(`/api/v1/groups/${groupId}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createGroup(
  token: string,
  payload: { name: string },
): Promise<CreateGroupResponse> {
  return fetchJson<CreateGroupResponse>(buildUrl('/api/v1/groups'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

export function addGroupMember(
  token: string,
  groupId: string,
  identifier: string,
): Promise<GroupDetail> {
  return fetchJson<GroupDetail>(buildUrl(`/api/v1/groups/${groupId}/members`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ identifier }),
  });
}

export function removeGroupMember(
  token: string,
  groupId: string,
  userId: string,
): Promise<void> {
  return fetchJson<void>(buildUrl(`/api/v1/groups/${groupId}/members/${userId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
