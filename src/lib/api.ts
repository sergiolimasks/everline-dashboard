// Everline API client — fetch wrapper pointing at the local Express API (Everline/api).
// Auth runs on httpOnly cookies set by the server; the browser attaches them
// automatically when credentials: 'include' is set, so there's no token to manage here.

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Fired by request() on 401s so shared handlers (e.g. Auth context, route guard)
// can react without every caller having to detect it.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  onUnauthorized = fn;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : null;

  if (res.status === 401) {
    // Fire the handler for every 401 EXCEPT on /auth/me checks during boot,
    // which legitimately return 401 for anonymous visitors.
    if (onUnauthorized && !path.startsWith('/auth/me')) onUnauthorized();
    throw new ApiError(data?.error || 'Não autenticado', 401);
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  }
  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = any>(path: string) => request<T>('DELETE', path),
};

// ======================== Auth ========================

export interface AuthUser {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { user } = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
  return user;
}

export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { user } = await api.get<{ user: AuthUser }>('/auth/me');
    return user;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Even if the call fails (offline, 500), the client-side session is gone.
  }
}

// ======================== Admin / CRUD ========================

export interface Profile {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at?: string | null;
  last_login_at?: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: string;
}

export interface CampaignAccess {
  id: string;
  user_id: string;
  client_id: string;
  offer_slug: string;
  label: string | null;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
}

export interface ClientOffer {
  id: string;
  client_id: string;
  offer_slug: string;
  label: string;
}

export const admin = {
  listProfiles: () => api.get<Profile[]>('/profiles'),
  createUser: (payload: { email: string; password: string; role?: string; displayName?: string }) =>
    api.post<{ success: boolean; user_id: string }>('/users', payload),
  changePassword: (userId: string, newPassword: string) =>
    api.patch<{ success: boolean }>(`/users/${userId}/password`, { newPassword }),
  deleteUser: (userId: string) => api.delete<{ success: boolean }>(`/users/${userId}`),

  listUserRoles: () => api.get<UserRoleRow[]>('/user_roles'),
  listMyRoles: () => api.get<UserRoleRow[]>('/user_roles/me'),
  assignRole: (user_id: string, role: string) =>
    api.post<{ success: boolean; id: string }>('/user_roles', { user_id, role }),
  removeRole: (user_id: string) =>
    api.delete<{ success: boolean; removed: number }>(`/user_roles/user/${user_id}`),

  listAccess: (userId?: string) =>
    api.get<CampaignAccess[]>(`/user_campaign_access${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`),
  listMyAccess: () => api.get<CampaignAccess[]>('/user_campaign_access?user_id=me'),
  assignAccess: (user_id: string, client_id: string, offer_slug: string, label?: string) =>
    api.post<{ success: boolean; id: string }>('/user_campaign_access', { user_id, client_id, offer_slug, label }),
  removeAccess: (id: string) => api.delete<{ success: boolean }>(`/user_campaign_access/${id}`),

  listClients: () => api.get<Client[]>('/clients'),
  listClientOffers: () => api.get<ClientOffer[]>('/client_offers'),
  createClientOffer: (client_id: string, offer_slug: string, label: string) =>
    api.post<{ success: boolean; id: string }>('/client_offers', { client_id, offer_slug, label }),
  deleteClientOffer: (id: string) => api.delete<{ success: boolean }>(`/client_offers/${id}`),
};
