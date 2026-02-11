'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Home, User, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface SidebarProps {
  onNavigate?: () => void;
  className?: string;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

const SIDEBAR_COLLAPSED_KEY = 'solo-board.sidebarCollapsed';

export function Sidebar({
  onNavigate,
  className,
  collapsed: collapsedProp,
  onCollapsedChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [collapsedState, setCollapsedState] = useState(false);

  const collapsed = collapsedProp ?? collapsedState;
  const setCollapsed = onCollapsedChange ?? setCollapsedState;

  useEffect(() => {
    if (collapsedProp !== undefined) return;
    try {
      const raw = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (raw === '1') setCollapsedState(true);
    } catch {
      // ignore
    }
  }, [collapsedProp]);

  useEffect(() => {
    if (collapsedProp !== undefined) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed, collapsedProp]);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      toast.success('已退出登录');
    } catch (error: any) {
      toast.error(`登出失败：${error.message}`);
    } finally {
      // 使用完整跳转，确保所有前端状态被重置，并依赖后端 Session 校验保护业务接口
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/profile', label: '个人管理', icon: User },
  ];

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  }, []);
  const sidebarShortcutText = isMac ? '折叠导航栏：⌘B' : '折叠导航栏：Ctrl+B';
  const folderPanelShortcutText = isMac ? '折叠目录面板：⌘⇧D' : '折叠目录面板：Ctrl+Shift+D';

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={cn(
          'sticky top-0 flex h-screen flex-col border-r border-border bg-card',
          collapsed ? 'w-14' : 'w-64',
          className,
        )}
      >
      {/* Logo/Title */}
      <div className={cn('flex h-16 items-center justify-between border-b border-border', collapsed ? 'px-2' : 'px-6')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent" onClick={onNavigate} aria-label="Solo-Board">
                <Home className="h-5 w-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Solo-Board</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/" className="text-lg font-semibold text-foreground" onClick={onNavigate}>
            Solo-Board
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={collapsed ? '展开导航栏' : '折叠导航栏'}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
        <div className={cn('mb-2 space-y-1', collapsed ? 'hidden' : 'block')}>
          <div className="text-xs text-muted-foreground">{sidebarShortcutText}</div>
          <div className="text-xs text-muted-foreground">{folderPanelShortcutText}</div>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/' && pathname?.startsWith('/editor'));
          const button = (
            <Button
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full',
                collapsed ? 'justify-center px-0' : 'justify-start',
                isActive && 'bg-accent text-accent-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', collapsed ? '' : 'mr-2')} />
              {collapsed ? null : item.label}
            </Button>
          );

          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={cn('border-t border-border', collapsed ? 'p-2' : 'p-4')}>
        <Button
          variant="ghost"
          className={cn('w-full', collapsed ? 'justify-center px-0' : 'justify-start')}
          onClick={handleLogout}
          aria-label="登出"
        >
          <LogOut className={cn('h-5 w-5', collapsed ? '' : 'mr-2')} />
          {collapsed ? null : '登出'}
        </Button>
      </div>
      </div>
    </TooltipProvider>
  );
}
