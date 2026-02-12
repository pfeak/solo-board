/**
 * 语言偏好：localStorage，默认英文。用于首次登录选择与个人偏好页修改。
 */
const LOCALE_KEY = 'solo-board-locale';

export type Locale = 'en' | 'zh';

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const v = localStorage.getItem(LOCALE_KEY);
  return v === 'zh' ? 'zh' : 'en';
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALE_KEY, locale);
}

export function hasStoredLocale(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOCALE_KEY) !== null;
}
