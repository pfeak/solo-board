'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { setStoredLocale } from '@/lib/locale';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocale } from '@/components/LocaleProvider';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.checkInitialPassword();
        if (cancelled) return;
        if (!res.is_initial_password) {
          router.replace('/');
        }
      } catch {
        // 401 handled by api layer
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t('changePassword.validationCurrent');
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = t('changePassword.validationNew');
    } else {
      if (newPassword.length < 8) {
        newErrors.newPassword = t('changePassword.validationNewLength');
      } else if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
        newErrors.newPassword = t('changePassword.validationNewFormat');
      }
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('changePassword.validationConfirm');
    } else if (newPassword && newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('changePassword.validationMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 前端表单验证
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success(t('changePassword.success'));
      setTimeout(async () => {
        try {
          const me = await authApi.me();
          const locale = me.preferences?.locale;
          if (locale) {
            setStoredLocale(locale);
            router.replace('/');
          } else {
            router.replace('/profile/preferences?first=1');
          }
        } catch {
          router.replace('/');
        }
      }, 100);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, t('changePassword.fail'), t);

      if (errorMessage.includes('当前密码') || errorMessage.includes('密码错误') || errorMessage.toLowerCase().includes('password')) {
        setErrors({ currentPassword: errorMessage });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">{t('changePassword.title')}</h1>
            <p className="text-muted-foreground">{t('changePassword.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('changePassword.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                placeholder={t('changePassword.placeholderCurrent')}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errors.currentPassword) {
                    setErrors({ ...errors, currentPassword: undefined });
                  }
                }}
                className={
                  errors.currentPassword
                    ? 'border-destructive focus-visible:ring-destructive placeholder:text-muted-foreground/60'
                    : 'placeholder:text-muted-foreground/60'
                }
              />
              {errors.currentPassword && (
                <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.currentPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">
                {t('changePassword.newPassword')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder={t('changePassword.placeholderNew')}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                  // 如果确认密码已填写，重新验证一致性
                  if (confirmPassword && e.target.value !== confirmPassword) {
                    setErrors({
                      ...errors,
                      newPassword: undefined,
                      confirmPassword: t('changePassword.validationMismatch'),
                    });
                  } else if (confirmPassword && e.target.value === confirmPassword) {
                    setErrors({ ...errors, newPassword: undefined, confirmPassword: undefined });
                  }
                }}
                className={
                  errors.newPassword
                    ? 'border-destructive focus-visible:ring-destructive placeholder:text-muted-foreground/60'
                    : 'placeholder:text-muted-foreground/60'
                }
              />
              {errors.newPassword && (
                <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.newPassword}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t('changePassword.confirmPassword')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder={t('changePassword.placeholderConfirm')}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                  // 实时验证一致性
                  if (newPassword && e.target.value !== newPassword) {
                    setErrors({
                      ...errors,
                      confirmPassword: t('changePassword.validationMismatch'),
                    });
                  } else if (newPassword && e.target.value === newPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                }}
                className={
                  errors.confirmPassword
                    ? 'border-destructive focus-visible:ring-destructive placeholder:text-muted-foreground/60'
                    : 'placeholder:text-muted-foreground/60'
                }
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('changePassword.submitting')}
                </>
              ) : (
                t('changePassword.submit')
              )}
            </Button>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}
