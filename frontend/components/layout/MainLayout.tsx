'use client';

import { useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SIDEBAR_COLLAPSED_KEY = 'solo-board.sidebarCollapsed';

function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.isContentEditable) return true;
  return false;
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === '1') setDesktopSidebarCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, desktopSidebarCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // PRD: avoid triggering shortcuts while typing
      if (isEditableTarget(e.target)) return;

      // Sidebar toggle: Ctrl+B (Win/Linux) / ⌘B (macOS)
      const isToggle =
        (isMac && e.metaKey && !e.ctrlKey && !e.shiftKey && (e.key === 'b' || e.key === 'B')) ||
        (!isMac && e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'b' || e.key === 'B'));

      if (isToggle) {
        e.preventDefault();
        setDesktopSidebarCollapsed((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMac]);

  return (
    <div className="flex h-screen">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar collapsed={desktopSidebarCollapsed} onCollapsedChange={setDesktopSidebarCollapsed} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-16 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="打开侧边栏"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="text-sm font-semibold text-foreground">Solo-Board</div>
          <div className="h-9 w-9" />
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Mobile sidebar dialog */}
      <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DialogContent className="h-[100vh] max-w-[320px] p-0 sm:rounded-none">
          <DialogHeader className="sr-only">
            <DialogTitle>侧边栏</DialogTitle>
          </DialogHeader>
          <Sidebar onNavigate={() => setMobileSidebarOpen(false)} className="h-full w-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
