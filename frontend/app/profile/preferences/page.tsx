'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getStoredLocale, setStoredLocale, type Locale } from '@/lib/locale';
import { authApi } from '@/lib/api';
import { Settings, Globe } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { toast } from 'sonner';
import { useLocale } from '@/components/LocaleProvider';

const LOCALE_OPTIONS: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'preferences.english' },
  { value: 'zh', labelKey: 'preferences.chinese' },
];

function PreferencesContent() {
  const searchParams = useSearchParams();
  const isFirstTime = searchParams.get('first') === '1';
  const { t, locale } = useLocale();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = async (newLocale: Locale) => {
    try {
      await authApi.setPreferences({ locale: newLocale });
      setStoredLocale(newLocale);
      toast.success(t('preferences.saved'));
      if (typeof window !== 'undefined') {
        if (isFirstTime) {
          window.location.href = '/';
        } else {
          window.location.reload();
        }
      }
    } catch {
      toast.error(t('preferences.saveFailed'));
    }
  };

  if (!mounted) {
    return (
      <ErrorBoundary>
        <MainLayout>
          <div className="container mx-auto max-w-4xl space-y-6 p-6">
            <div className="h-10 w-48 rounded bg-muted animate-pulse" />
            <div className="h-64 rounded-lg bg-muted animate-pulse" />
          </div>
        </MainLayout>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainLayout>
        <div className="container mx-auto max-w-4xl space-y-6 p-6">
          <h1 className="text-3xl font-bold">{t('preferences.title')}</h1>

          {isFirstTime && (
            <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {t('preferences.firstTimeHint')}
            </p>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Globe className="h-5 w-5" />
                {t('preferences.language')}
              </CardTitle>
              <CardDescription>
                {t('preferences.languageDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="divide-y divide-border">
                <div className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <dt className="flex min-w-[8rem] items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Settings className="h-4 w-4 shrink-0" />
                    {t('preferences.currentLanguage')}
                  </dt>
                  <dd className="text-sm font-medium">
                    {locale === 'zh' ? t('preferences.chinese') : t('preferences.english')}
                  </dd>
                </div>
                <div className="px-6 py-5">
                  <p className="mb-3 text-sm font-medium text-muted-foreground">
                    {t('preferences.selectLanguage')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {LOCALE_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={locale === opt.value ? 'default' : 'outline'}
                        size="default"
                        className="min-w-[8rem]"
                        onClick={() => handleSave(opt.value)}
                      >
                        <Globe className="mr-2 h-4 w-4 shrink-0" />
                        {t(opt.labelKey)}
                      </Button>
                    ))}
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ErrorBoundary>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense
      fallback={
        <ErrorBoundary>
          <MainLayout>
            <div className="container mx-auto max-w-4xl space-y-6 p-6">
              <div className="h-10 w-48 rounded bg-muted animate-pulse" />
              <div className="h-64 rounded-lg bg-muted animate-pulse" />
            </div>
          </MainLayout>
        </ErrorBoundary>
      }
    >
      <PreferencesContent />
    </Suspense>
  );
}
