import { apiFetch } from './client';

export interface Venue {
  id: string;
  name: string;
  addressText: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  pitchCount: number;
  createdAt: string;
}

export interface Pitch {
  id: string;
  venueId: string;
  name: string;
  pitchType: string;
  price: number | null;
  isActive: boolean;
  createdAt: string;
}

export function listVenues(): Promise<Venue[]> {
  return apiFetch<{ items: Venue[] }>('/admin/venues').then((r) => r.items);
}

export function listPitches(venueId: string): Promise<Pitch[]> {
  return apiFetch<{ items: Pitch[] }>(`/admin/venues/${venueId}/pitches`).then((r) => r.items);
}

export function createVenue(data: {
  name: string;
  addressText?: string | null;
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<Venue> {
  return apiFetch<Venue>('/admin/venues', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateVenue(
  id: string,
  data: {
    name?: string;
    addressText?: string | null;
    mapsUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    isActive?: boolean;
  },
): Promise<Venue> {
  return apiFetch<Venue>(`/admin/venues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function createPitch(
  venueId: string,
  data: { name: string; pitchType: string; price?: number | null },
): Promise<Pitch> {
  return apiFetch<Pitch>(`/admin/venues/${venueId}/pitches`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePitch(
  venueId: string,
  pitchId: string,
  data: { name?: string; pitchType?: string; price?: number | null; isActive?: boolean },
): Promise<Pitch> {
  return apiFetch<Pitch>(`/admin/venues/${venueId}/pitches/${pitchId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
