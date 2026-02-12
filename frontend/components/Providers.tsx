'use client';

import { ThemeProvider } from 'next-themes';
import { LocaleProvider } from '@/components/LocaleProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <LocaleProvider>
        {children}
      </LocaleProvider>
    </ThemeProvider>
  );
}

