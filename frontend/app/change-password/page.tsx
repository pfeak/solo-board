'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Guard: only allow when using initial password
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.checkInitialPassword();
        if (cancelled) return;
        if (!res.is_initial_password) {
          router.replace('/');
        }
      } catch {
        // 401 handled by api layer redirect; ignore other errors here
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const validateForm = (): boolean => {
    const newErrors: {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = '请填写当前密码';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = '请填写新密码';
    } else {
      if (newPassword.length < 8) {
        newErrors.newPassword = '新密码长度至少 8 位';
      } else if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
        newErrors.newPassword = '新密码必须包含字母和数字';
      }
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = '请填写确认密码';
    } else if (newPassword && newPassword !== confirmPassword) {
      newErrors.confirmPassword = '确认密码与新密码不一致';
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
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('密码修改成功');
      // 使用 replace 避免历史记录问题，并稍微延迟确保 Cookie 写入完成
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, '修改失败：请稍后重试');

      // 检查是否是字段级错误（如"当前密码错误"）
      if (errorMessage.includes('当前密码') || errorMessage.includes('密码错误')) {
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold">修改密码</h1>
            <p className="text-muted-foreground">首次登录需要修改密码</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">当前密码</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="请输入当前密码"
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
              <Label htmlFor="new-password">
                新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="至少 8 位，包含字母和数字"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.newPassword) {
                    setErrors({ ...errors, newPassword: undefined });
                  }
                  // 如果确认密码已填写，重新验证一致性
                  if (confirmPassword && e.target.value !== confirmPassword) {
                    setErrors({
                      ...errors,
                      newPassword: undefined,
                      confirmPassword: '确认密码与新密码不一致',
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
              <Label htmlFor="confirm-password">
                确认新密码 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="请再次输入新密码"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: undefined });
                  }
                  // 实时验证一致性
                  if (newPassword && e.target.value !== newPassword) {
                    setErrors({
                      ...errors,
                      confirmPassword: '确认密码与新密码不一致',
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  修改中...
                </>
              ) : (
                '修改密码'
              )}
            </Button>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}
