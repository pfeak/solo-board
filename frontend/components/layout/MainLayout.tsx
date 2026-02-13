'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocale } from '@/components/LocaleProvider';
import { cn } from '@/lib/utils';

export interface MainLayoutProps {
  children: React.ReactNode;
  /** When provided, replaces the default Sidebar (e.g. editor toolbar in sidebar slot). */
  sidebarReplacement?: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = 'solo-board-editor-sidebar-collapsed';

export function MainLayout({ children, sidebarReplacement }: MainLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  });
  const { t } = useLocale();
  const pathname = usePathname();

  // 仅在画板编辑页允许折叠侧边栏；主界面始终展开
  const isEditorPage = pathname?.startsWith('/editor');
  const effectiveCollapsed = isEditorPage ? sidebarCollapsed : false;

  const toggleSidebar = () => {
    if (!isEditorPage) return;
    const newValue = !sidebarCollapsed;
    setSidebarCollapsed(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
    }
  };

  // 仅在画板编辑页使用 Ctrl+B 折叠/展开侧边栏
  useEffect(() => {
    if (!isEditorPage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isToggleKey = e.key === 'b' || e.key === 'B';
      const isModKey = (e.ctrlKey && !e.metaKey) || e.metaKey;
      if (isToggleKey && isModKey) {
        e.preventDefault();
        setSidebarCollapsed((prev) => {
          const next = !prev;
          if (typeof window !== 'undefined') {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorPage]);

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar or replacement (e.g. editor toolbar) */}
      <div
        className={cn(
          'hidden lg:block transition-all duration-300',
          effectiveCollapsed ? 'w-0' : 'w-64',
        )}
      >
        <div
          className={cn(
            'h-full transition-opacity duration-300',
            effectiveCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
        >
          {sidebarReplacement ?? <Sidebar />}
        </div>
      </div>

      {/* Toggle button (desktop) - 仅在画板编辑页展示 */}
      {isEditorPage && (
        <div className="hidden lg:block">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'fixed top-32 z-50 h-8 w-8 rounded-r-md rounded-l-none border-r border-t border-b border-border bg-card shadow-sm transition-all duration-300 hover:bg-accent',
              effectiveCollapsed ? 'left-0' : 'left-64',
            )}
            onClick={toggleSidebar}
            aria-label={t('mainLayout.toggleSidebar')}
            title={`${t('mainLayout.toggleSidebar')} (${t('mainLayout.sidebarShortcut')})`}
          >
            {effectiveCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('mainLayout.openSidebar')}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="text-sm font-semibold text-foreground">Solo-Board</div>
          <div className="h-9 w-9" />
        </div>

        <main className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</main>
      </div>

      {/* Mobile sidebar dialog (only when using default Sidebar) */}
      {!sidebarReplacement && (
        <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <DialogContent className="h-[100vh] max-w-[320px] p-0 sm:rounded-none">
            <DialogHeader className="sr-only">
              <DialogTitle>{t('mainLayout.sidebarTitle')}</DialogTitle>
            </DialogHeader>
            <Sidebar onNavigate={() => setMobileSidebarOpen(false)} className="h-full w-full" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
