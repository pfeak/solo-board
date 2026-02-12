'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn, getErrorMessage } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';

export interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLocale();

  const handleLogout = async () => {
    try {
      await authApi.logout();
      toast.success(t('sidebar.logoutSuccess'));
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('sidebar.logoutFailed'), t));
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const mainNavItems = [{ href: '/', label: t('sidebar.workspace'), icon: Home }];

  const bottomItems = [
    { href: '/profile', label: t('sidebar.profile'), icon: User },
    { href: '/profile/preferences', label: t('sidebar.preferences'), icon: Settings },
  ];

  const isActive = (href: string) =>
    pathname === href || (href === '/' && pathname?.startsWith('/editor'));

  return (
    <div className={cn('sticky top-0 flex h-screen flex-col border-r border-border bg-card w-64 shadow-sm', className)}>
      {/* Logo/Title */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6 bg-card/50 backdrop-blur-sm">
        <Link href="/" className="text-lg font-semibold text-foreground hover:text-primary transition-colors" onClick={onNavigate}>
          Solo-Board
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto space-y-1 p-4">
        {mainNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-between group relative',
                  isActive(item.href) && 'bg-accent text-accent-foreground shadow-sm',
                  !isActive(item.href) && 'hover:bg-accent/50'
                )}
              >
                <div className="flex items-center">
                  <Icon className="h-5 w-5 mr-2" />
                  <span>{item.label}</span>
                </div>
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Bottom items: Profile, Preferences, Logout */}
      <div className="border-t border-border space-y-1 p-4 bg-card/50 backdrop-blur-sm">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start group',
                  isActive(item.href) && 'bg-accent text-accent-foreground shadow-sm',
                  !isActive(item.href) && 'hover:bg-accent/50'
                )}
              >
                <Icon className="h-5 w-5 mr-2" />
                {item.label}
              </Button>
            </Link>
          );
        })}
        <Button
          variant="ghost"
          className="w-full justify-start hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={handleLogout}
          aria-label={t('sidebar.logout')}
        >
          <LogOut className="h-5 w-5 mr-2" />
          {t('sidebar.logout')}
        </Button>
      </div>
    </div>
  );
}
