'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function LoginPage() {
  const router = useRouter();
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
      newErrors.username = '请填写用户名';
    }

    if (!password.trim()) {
      newErrors.password = '请填写密码';
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
      // 使用 replace 而不是 push，避免历史记录问题
      // 稍微延迟确保 Cookie 设置完成
      setTimeout(() => {
        if (result.is_initial_password) {
          router.replace('/change-password');
        } else {
          router.replace('/');
        }
      }, 100);
    } catch (error: unknown) {
      // 统一错误处理
      const errorMessage = getErrorMessage(error, '用户名或密码错误');
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">Solo-Board 管理员登录</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
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
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
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
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            默认账号：admin / 123456
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
}
