'use client';

import { useState } from 'react';
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

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    password?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      newErrors.username = t('login.validationUsername');
    }

    if (!password.trim()) {
      newErrors.password = t('login.validationPassword');
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
      const result = await authApi.login(username, password);
      setTimeout(() => {
        if (result.is_initial_password) {
          router.replace('/change-password');
        } else {
          const locale = result.preferences?.locale;
          if (locale) {
            setStoredLocale(locale);
          }
          if (locale) {
            router.replace('/');
          } else {
            router.replace('/profile/preferences?first=1');
          }
        }
      }, 100);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, t('login.errorAuth'), t);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center w-full max-w-lg px-4">
          <div className="w-full max-w-lg space-y-6 rounded-2xl border border-border bg-card p-10 shadow-lg shadow-black/5">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold">{t('login.title')}</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('login.username')}</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder={t('login.placeholderUsername')}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errors.username) {
                      setErrors({ ...errors, username: undefined });
                    }
                  }}
                  className={errors.username ? 'border-destructive focus-visible:ring-destructive placeholder:text-muted-foreground/60' : 'placeholder:text-muted-foreground/60'}
                />
                {errors.username && (
                  <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.username}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t('login.placeholderPassword')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors({ ...errors, password: undefined });
                    }
                  }}
                  className={errors.password ? 'border-destructive focus-visible:ring-destructive placeholder:text-muted-foreground/60' : 'placeholder:text-muted-foreground/60'}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.password}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('login.submitting')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </Button>
            </form>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('login.poweredByPrefix')}
            <a
              href="https://github.com/pfeak/solo-board"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4 hover:no-underline"
            >
              {t('login.poweredByLink')}
            </a>
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
