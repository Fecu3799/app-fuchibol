import { apiFetch } from './client';

export interface LoginResponse {
  accessToken: string;
  user: { id: string; role: string; username: string };
}

export async function loginAdmin(
  identifier: string,
  password: string,
): Promise<LoginResponse> {
  const data = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  if (data.user.role !== 'ADMIN') {
    throw new Error('Acceso denegado: no tenés permisos de administrador.');
  }
  return data;
}
