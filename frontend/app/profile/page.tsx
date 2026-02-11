'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ProfilePage() {
  const [user, setUser] = useState<{
    id: string;
    username: string;
    created_at: number;
    last_login_at: number | null;
  } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userLoadError, setUserLoadError] = useState(false);
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const data = await authApi.me();
      setUser(data);
      setUserLoadError(false);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, '加载用户信息失败');
      // 401 由 API 封装层处理，这里只处理其他错误
      if (!errorMessage.includes('Unauthenticated')) {
        toast.error(errorMessage);
        setUserLoadError(true);
      }
    } finally {
      setLoadingUser(false);
    }
  };

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

  const handleChangePassword = async (e: React.FormEvent) => {
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
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
      <MainLayout>
        <div className="container mx-auto max-w-4xl space-y-6 p-6">
          <h1 className="text-3xl font-bold">个人管理</h1>

          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>个人信息</CardTitle>
              <CardDescription>查看您的账户信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingUser ? (
                <div className="space-y-4">
                  <div>
                    <Label>用户名</Label>
                    <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                  </div>
                  <div>
                    <Label>创建时间</Label>
                    <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                  </div>
                  <div>
                    <Label>最后登录时间</Label>
                    <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ) : userLoadError ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  加载失败，请刷新页面重试
                </div>
              ) : (
                <>
                  <div>
                    <Label>用户名</Label>
                    <p className="text-sm font-medium">{user?.username || '-'}</p>
                  </div>
                  <div>
                    <Label>创建时间</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.created_at ? formatTimestamp(user.created_at) : '-'}
                    </p>
                  </div>
                  <div>
                    <Label>最后登录时间</Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.last_login_at ? formatTimestamp(user.last_login_at) : '-'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>修改密码</CardTitle>
              <CardDescription>修改您的登录密码</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
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

                <Button type="submit" disabled={loading}>
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
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    </ErrorBoundary>
  );
}
