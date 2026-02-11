import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 统一错误信息提取函数
 * 从异常对象中提取可读错误信息，优先使用后端返回的 detail
 * @param error - 错误对象
 * @param fallback - 回退错误信息
 * @returns 可读的错误信息
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}
