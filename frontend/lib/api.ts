/**
 * Frontend API helper.
 *
 * Rules:
 * - All HTTP calls should go through this module
 * - Always send cookies (credentials: 'include')
 * - On 401, redirect to /login
 */

/**
 * API error with a machine-readable code for i18n mapping.
 * When no backend detail is available, we throw ApiError(code) so the UI can show t('api.xxx').
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

/**
 * Use same-origin `/api/*` by default and proxy via Next rewrites.
 * This avoids cross-origin cookie issues (SameSite=Strict + localhost/127 mismatch).
 *
 * Important:
 * - In the browser, ALWAYS use same-origin `/api/*` so cookies are reliably sent.
 * - Backend destination is configured via Next rewrites (see `next.config.mjs`).
 */
const API_BASE_URL = '';

function statusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 500:
      return 'SERVER_ERROR';
    default:
      return 'REQUEST_FAILED';
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    const hasBody = options?.body !== undefined && options?.body !== null;
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError('NETWORK_ERROR');
  }

  const result = await response.json().catch(() => null);

  if (response.status === 401 && typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    const isLoginEndpoint = endpoint.includes('/api/auth/login');

    if (!isLoginEndpoint && currentPath !== '/login') {
      window.location.href = '/login';
    }

    if (isLoginEndpoint) {
      const detail =
        (result && typeof result === 'object' && 'detail' in result && result.detail) ||
        null;
      if (detail && typeof detail === 'string') {
        throw new Error(detail);
      }
      throw new ApiError('UNAUTHORIZED');
    }

    throw new ApiError('UNAUTHORIZED');
  }

  if (!response.ok) {
    const detail =
      (result && typeof result === 'object' && 'detail' in result && result.detail) ||
      null;

    if (detail && typeof detail === 'string') {
      throw new Error(detail);
    }
    throw new ApiError(statusToCode(response.status));
  }

  return result as T;
}

// User preferences (stored in DB)
export interface UserPreferences {
  locale?: 'en' | 'zh';
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<{
      id: string;
      username: string;
      is_initial_password: boolean;
      preferences?: UserPreferences | null;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    apiRequest<{ detail: string }>('/api/auth/logout', {
      method: 'POST',
    }),
  me: () =>
    apiRequest<{
      id: string;
      username: string;
      created_at: number;
      last_login_at: number | null;
      is_initial_password: boolean;
      preferences?: UserPreferences | null;
    }>('/api/auth/me'),
  getPreferences: () =>
    apiRequest<UserPreferences>('/api/auth/preferences'),
  setPreferences: (prefs: UserPreferences) =>
    apiRequest<UserPreferences>('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),
  checkInitialPassword: () =>
    apiRequest<{ is_initial_password: boolean }>('/api/auth/check-initial-password'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<{ detail: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    }),
};

// Folder API
export interface FolderItem {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
  children?: FolderItem[];
}

export const folderApi = {
  getTree: (parentId?: string | null) =>
    apiRequest<FolderItem[]>(
      `/api/folders${parentId !== undefined ? `?parent_id=${parentId || ''}` : ''}`,
    ),
  getById: (folderId: string) =>
    apiRequest<FolderItem>(`/api/folders/${folderId}`),
  create: (name: string, parentId?: string | null) =>
    apiRequest<FolderItem>('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId || null }),
    }),
  update: (folderId: string, updates: { name?: string; parent_id?: string | null }) =>
    apiRequest<FolderItem>(`/api/folders/${folderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (folderId: string) =>
    apiRequest<void>(`/api/folders/${folderId}`, {
      method: 'DELETE',
    }),
  getChildren: (folderId: string) =>
    apiRequest<{
      folders: Array<{ id: string; name: string; created_at: number; updated_at: number }>;
      files: Array<{ id: string; name: string; created_at: number; updated_at: number }>;
    }>(`/api/folders/${folderId}/children`),
};

// File API
export interface FileItem {
  id: string;
  folder_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface FileDetail extends FileItem {
  content: string;
}

export interface FileListResult {
  total: number;
  page: number;
  page_size: number;
  items: FileItem[];
}

export const fileApi = {
  getList: (params?: {
    folder_id?: string | null;
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.folder_id !== undefined) {
      query.set('folder_id', params.folder_id || '');
    }
    if (params?.search) {
      query.set('search', params.search);
    }
    if (params?.page) {
      query.set('page', String(params.page));
    }
    if (params?.page_size) {
      query.set('page_size', String(params.page_size));
    }
    return apiRequest<FileListResult>(`/api/files?${query.toString()}`);
  },
  getById: (fileId: string) =>
    apiRequest<FileDetail>(`/api/files/${fileId}`),
  create: (name: string, folderId?: string | null, content?: string) =>
    apiRequest<FileItem>('/api/files', {
      method: 'POST',
      body: JSON.stringify({
        name,
        folder_id: folderId || null,
        content: content || '{}',
      }),
    }),
  update: (fileId: string, updates: { name?: string; content?: string; folder_id?: string | null }) =>
    apiRequest<FileItem>(`/api/files/${fileId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  delete: (fileId: string) =>
    apiRequest<void>(`/api/files/${fileId}`, {
      method: 'DELETE',
    }),
};

