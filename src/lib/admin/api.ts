const STORAGE_KEY = 'admin_auth';

export function getStoredPassword(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setStoredPassword(password: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, password);
}

export function clearStoredPassword() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function adminPost<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  const password = getStoredPassword();
  if (!password) return { success: false, error: 'No autenticado' };

  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, ...body }),
    });
    return (await res.json()) as ApiResult<T>;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error de red' };
  }
}

async function adminDelete<T>(path: string): Promise<ApiResult<T>> {
  const password = getStoredPassword();
  if (!password) return { success: false, error: 'No autenticado' };

  try {
    const res = await fetch(path, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    return (await res.json()) as ApiResult<T>;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error de red' };
  }
}

export interface PostcardListParams {
  page?: number;
  limit?: number;
  status?: 'all' | 'ready' | 'processing' | 'error' | 'needs_better_image';
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'title' | 'ar_view_count';
  sortDir?: 'asc' | 'desc';
  userId?: string;
}

export interface AdminUser {
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl?: string | null;
}

export interface AdminPostcard {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string;
  video_url: string;
  processing_status: 'processing' | 'ready' | 'error' | 'needs_better_image';
  error_message: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  ar_view_count: number;
  user: AdminUser;
  arLink: string;
}

export interface PostcardListResponse {
  postcards: AdminPostcard[];
  stats: {
    total: number;
    ready: number;
    processing: number;
    error: number;
    needsBetterImage: number;
    uniqueUsers: number;
    totalArViews: number;
  };
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AnalyticsResponse {
  daily: Array<{ date: string; created: number; views: number }>;
  previousPeriod: { created: number; views: number };
  currentPeriod: { created: number; views: number };
  topPostcards: Array<Pick<AdminPostcard, 'id' | 'title' | 'image_url' | 'ar_view_count' | 'user'>>;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  postcardCount: number;
  totalViews: number;
  lastActivity: string | null;
}

export const api = {
  verify: (password: string) =>
    fetch('/api/admin/postcards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, limit: 0 }),
    }).then(r => r.json() as Promise<ApiResult<PostcardListResponse>>),

  listPostcards: (params: PostcardListParams = {}) =>
    adminPost<PostcardListResponse>('/api/admin/postcards', { ...params }),

  getPostcard: (id: string) =>
    adminPost<AdminPostcard & { timeline: Array<{ type: string; at: string; meta?: unknown }> }>(
      `/api/admin/postcards/${id}`,
      {}
    ),

  deletePostcard: (id: string) => adminDelete<{ id: string }>(`/api/admin/postcards/${id}`),

  analytics: (days = 30) =>
    adminPost<AnalyticsResponse>('/api/admin/analytics', { days }),

  listUsers: () => adminPost<{ users: UserSummary[] }>('/api/admin/users', {}),
};
