import { buildUrl, fetchJson } from '../../lib/api';
import type {
  ListVenuesAdminResponse,
  ListPitchesAdminResponse,
  VenueAdmin,
  PitchAdmin,
} from '../../types/api';

// ── Venues ──

export function listVenuesAdmin(): Promise<ListVenuesAdminResponse> {
  return fetchJson<ListVenuesAdminResponse>(buildUrl('/api/v1/admin/venues'));
}

export function createVenueAdmin(data: {
  name: string;
  addressText?: string;
  mapsUrl?: string;
  latitude?: number;
  longitude?: number;
}): Promise<VenueAdmin> {
  return fetchJson<VenueAdmin>(buildUrl('/api/v1/admin/venues'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updateVenueAdmin(
  id: string,
  data: {
    name?: string;
    addressText?: string;
    mapsUrl?: string;
    latitude?: number;
    longitude?: number;
    isActive?: boolean;
  },
): Promise<VenueAdmin> {
  return fetchJson<VenueAdmin>(buildUrl(`/api/v1/admin/venues/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Pitches ──

export function listPitchesAdmin(venueId: string): Promise<ListPitchesAdminResponse> {
  return fetchJson<ListPitchesAdminResponse>(
    buildUrl(`/api/v1/admin/venues/${venueId}/pitches`),
  );
}

export function createPitchAdmin(
  venueId: string,
  data: { name: string; pitchType: string; price?: number },
): Promise<PitchAdmin> {
  return fetchJson<PitchAdmin>(buildUrl(`/api/v1/admin/venues/${venueId}/pitches`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updatePitchAdmin(
  venueId: string,
  pitchId: string,
  data: { name?: string; pitchType?: string; price?: number; isActive?: boolean },
): Promise<PitchAdmin> {
  return fetchJson<PitchAdmin>(
    buildUrl(`/api/v1/admin/venues/${venueId}/pitches/${pitchId}`),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
}
