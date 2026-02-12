'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, User, Calendar, LogIn, KeyRound } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLocale } from '@/components/LocaleProvider';
import type { Locale } from '@/lib/locale';

function formatTimestamp(timestamp: number, locale: Locale): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfilePage() {
  const { t, locale } = useLocale();
  const [user, setUser] = useState<{
    id: string;
    username: string;
    created_at: number;
    last_login_at: number | null;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userLoadError, setUserLoadError] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await authApi.me();
      setUser(data);
      setUserLoadError(false);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return;
      const errorMessage = getErrorMessage(error, t('profile.loadUserError'), t);
      toast.error(errorMessage);
      setUserLoadError(true);
    } finally {
      setLoadingUser(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = t('profile.validationCurrent');
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = t('profile.validationNew');
    } else {
      if (newPassword.length < 8) {
        newErrors.newPassword = t('profile.validationNewLength');
      } else if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
        newErrors.newPassword = t('profile.validationNewFormat');
      }
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = t('profile.validationConfirm');
    } else if (newPassword && newPassword !== confirmPassword) {
      newErrors.confirmPassword = t('profile.validationMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
      <MainLayout>
        <div className="container mx-auto max-w-4xl space-y-6 p-6">
          <h1 className="text-3xl font-bold">{t('profile.title')}</h1>

          {/* User Info Card */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <User className="h-5 w-5" />
                {t('profile.personalInfo')}
              </CardTitle>
              <CardDescription>{t('profile.viewAccount')}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingUser ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 px-6 py-4">
                      <div className="h-5 w-24 shrink-0 rounded bg-muted animate-pulse" />
                      <div className="h-5 flex-1 max-w-xs rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : userLoadError ? (
                <div className="flex items-center gap-2 px-6 py-6 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {t('profile.refreshHint')}
                </div>
              ) : (
                <dl className="divide-y divide-border">
                  <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <dt className="flex min-w-[7rem] items-center gap-2 text-sm font-medium text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      {t('profile.username')}
                    </dt>
                    <dd className="text-sm font-medium">{user?.username || '-'}</dd>
                  </div>
                  <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <dt className="flex min-w-[7rem] items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" />
                      {t('profile.createdAt')}
                    </dt>
                    <dd className="text-sm text-muted-foreground">
                      {user?.created_at ? formatTimestamp(user.created_at, locale) : '-'}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-4">
                    <dt className="flex min-w-[7rem] items-center gap-2 text-sm font-medium text-muted-foreground">
                      <LogIn className="h-4 w-4 shrink-0" />
                      {t('profile.lastLogin')}
                    </dt>
                    <dd className="text-sm text-muted-foreground">
                      {user?.last_login_at ? formatTimestamp(user.last_login_at, locale) : '-'}
                    </dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <KeyRound className="h-5 w-5" />
                {t('profile.changePassword')}
              </CardTitle>
              <CardDescription>{t('profile.changePasswordDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-sm font-medium">
                    {t('profile.currentPassword')}
                  </Label>
                  <Input
                    id="current-password"
                    type="password"
                    placeholder={t('profile.placeholderCurrent')}
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
                  <Label htmlFor="new-password" className="text-sm font-medium">
                    {t('profile.newPassword')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder={t('profile.placeholderNew')}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (errors.newPassword) {
                        setErrors({ ...errors, newPassword: undefined });
                      }
                      if (confirmPassword && e.target.value !== confirmPassword) {
                        setErrors({
                          ...errors,
                          newPassword: undefined,
                          confirmPassword: t('profile.validationMismatch'),
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
                  <Label htmlFor="confirm-password" className="text-sm font-medium">
                    {t('profile.confirmPassword')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={t('profile.placeholderConfirm')}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword) {
                        setErrors({ ...errors, confirmPassword: undefined });
                      }
                      if (newPassword && e.target.value !== newPassword) {
                        setErrors({
                          ...errors,
                          confirmPassword: t('profile.validationMismatch'),
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

                <div className="pt-2">
                  <Button type="submit" disabled={loading} size="default">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('profile.submittingPassword')}
                      </>
                    ) : (
                      t('profile.submitPassword')
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ErrorBoundary>
  );
}
