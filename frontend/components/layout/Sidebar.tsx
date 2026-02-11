'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo/Title */}
      <div className="flex h-16 items-center border-b border-border px-6">
        <Link href="/" className="text-lg font-semibold text-foreground">
          Solo-Board
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href === '/' && pathname?.startsWith('/editor'));
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  isActive && 'bg-accent text-accent-foreground',
                )}
              >
                <Icon className="mr-2 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-border p-4">
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
          <LogOut className="mr-2 h-5 w-5" />
          登出
        </Button>
      </div>
    </div>
  );
}
