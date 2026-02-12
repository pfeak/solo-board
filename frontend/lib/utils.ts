import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ApiError } from '@/lib/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const API_CODE_TO_I18N: Record<string, string> = {
  NETWORK_ERROR: 'api.networkError',
  UNAUTHORIZED: 'api.unauthorized',
  BAD_REQUEST: 'api.badRequest',
  FORBIDDEN: 'api.forbidden',
  NOT_FOUND: 'api.notFound',
  SERVER_ERROR: 'api.serverError',
  REQUEST_FAILED: 'api.requestFailed',
};

/** Map known backend error messages (any language) to i18n keys so UI always shows localized text */
function mapBackendMessageToKey(message: string): string | null {
  const m = message.trim();
  // Network errors
  if (m.includes('网络连接失败') || /network.*error|network.*fail/i.test(m)) return 'api.networkError';
  // Auth errors
  if (m === '用户名或密码错误' || /invalid.*username.*password|invalid.*password.*username/i.test(m)) return 'login.errorAuth';
  if (m === '当前密码错误' || /current password.*incorrect|password.*incorrect/i.test(m)) return 'changePassword.errorCurrentPassword';
  if (m === '新密码长度至少 8 位' || /password.*at least.*8|password.*8.*characters/i.test(m)) return 'changePassword.validationNewLength';
  if (m === '新密码必须包含字母和数字' || /password.*letters.*numbers|password.*contain.*letters/i.test(m)) return 'changePassword.validationNewFormat';
  // Folder errors
  if (m === '文件夹名称不能为空' || /folder name.*empty|folder.*cannot.*empty/i.test(m)) return 'api.folderNameEmpty';
  if (m.includes('同目录下已存在同名文件夹') || /folder.*same name.*exists|folder.*already exists/i.test(m)) return 'api.conflictFolder';
  if (m.includes('文件夹不为空') || /folder.*not empty|folder.*cannot.*delete/i.test(m)) return 'api.folderNotEmpty';
  if (m.includes('仅支持一级目录') || /only.*one.*level.*folder|one level.*supported/i.test(m)) return 'api.oneLevelOnly';
  // File errors
  if (m === '文件名不能为空' || /file name.*empty|file.*cannot.*empty/i.test(m)) return 'api.fileNameEmpty';
  if (m.includes('同目录下已存在同名文件') || /file.*same name.*exists|file.*already exists/i.test(m)) return 'api.conflictFile';
  if (m.includes('不允许在顶层') || m.includes('请选择一个目录') || /select.*folder.*first|please.*select.*folder/i.test(m)) return 'api.selectFolderFirst';
  // Not found errors
  if (m.includes('资源不存在') || /resource.*not found/i.test(m)) return 'api.notFound';
  if (/File with id|file.*not found/i.test(m)) return 'editor.fileNotFound';
  if (/Folder with id|Target folder.*not found/i.test(m)) return 'api.notFound';
  // Auth/Unauthorized
  if (m === 'User not found' || m === 'Unauthenticated') return 'api.unauthorized';
  return null;
}

export type GetErrorMessageT = (key: string) => string;

/**
 * 统一错误信息提取函数，支持 i18n。
 * - 若为 ApiError 且传入 t，返回 t('api.xxx')
 * - 若为已知后端文案且传入 t，返回对应 t(key)
 * - 否则返回 error.message 或 fallback
 */
export function getErrorMessage(
  error: unknown,
  fallback: string,
  t?: GetErrorMessageT,
): string {
  if (error instanceof ApiError && t) {
    const key = API_CODE_TO_I18N[error.code] ?? 'api.requestFailed';
    return t(key);
  }
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (raw && t) {
    const key = mapBackendMessageToKey(raw);
    if (key) return t(key);
  }
  return raw || fallback;
}
