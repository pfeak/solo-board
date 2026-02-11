/**
 * Frontend API helper.
 *
 * Rules:
 * - All HTTP calls should go through this module
 * - Always send cookies (credentials: 'include')
 * - On 401, redirect to /login
 */

/**
 * Use same-origin `/api/*` by default and proxy via Next rewrites.
 * This avoids cross-origin cookie issues (SameSite=Strict + localhost/127 mismatch).
 *
 * Important:
 * - In the browser, ALWAYS use same-origin `/api/*` so cookies are reliably sent.
 * - Backend destination is configured via Next rewrites (see `next.config.mjs`).
 */
const API_BASE_URL = '';

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
  } catch (error) {
    // 网络错误（fetch 失败、超时等）
    throw new Error('网络连接失败，请稍后重试');
  }

  // 先解析响应，以便获取错误详情
  const result = await response.json().catch(() => null);

  // 401 未认证，自动跳转到登录页
  // 注意：
  // 1. 登录 API 本身返回 401 不应该跳转（登录失败是正常的）
  // 2. 如果当前已经在登录页，不跳转以避免循环
  if (response.status === 401 && typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    const isLoginEndpoint = endpoint.includes('/api/auth/login');

    // 登录 API 返回 401 不跳转，其他情况才跳转
    if (!isLoginEndpoint && currentPath !== '/login') {
      window.location.href = '/login';
    }

    // 对于登录 API，返回更友好的错误信息
    if (isLoginEndpoint) {
      const detail =
        (result && typeof result === 'object' && 'detail' in result && result.detail) ||
        '用户名或密码错误';
      throw new Error(String(detail));
    }

    throw new Error('Unauthenticated');
  }

  if (!response.ok) {
    // 优先使用后端返回的 detail
    const detail =
      (result && typeof result === 'object' && 'detail' in result && result.detail) ||
      null;

    // 根据状态码提供默认错误信息
    let errorMessage = detail || '请求失败';

    if (!detail) {
      switch (response.status) {
        case 400:
          errorMessage = '请求参数错误';
          break;
        case 403:
          errorMessage = '权限不足';
          break;
        case 404:
          errorMessage = '资源不存在';
          break;
        case 500:
          errorMessage = '服务器错误，请联系管理员或稍后重试';
          break;
        default:
          errorMessage = '请求失败，请稍后重试';
      }
    }

    throw new Error(String(errorMessage));
  }

  return result as T;
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    apiRequest<{ id: string; username: string; is_initial_password: boolean }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      },
    ),
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
    }>('/api/auth/me'),
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

