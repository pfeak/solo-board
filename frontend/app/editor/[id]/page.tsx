'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { ExcalidrawWrapper } from '@/components/editor/ExcalidrawWrapper';
import { Button } from '@/components/ui/button';
import { fileApi } from '@/lib/api';
import { createExcalidrawAdapter } from '@/lib/excalidraw/adapter';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;

  const adapter = useMemo(() => createExcalidrawAdapter(), []);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pendingAutoSaveRef = useRef(false);
  const isMountedRef = useRef(true);

  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const loadFile = useCallback(async () => {
    setLoading(true);
    try {
      const file = await fileApi.getById(fileId);
      setFileName(file.name);
      setContent(file.content || '{}');
      setDirty(false);
      setLastSavedAt(null);
    } catch (error: any) {
      // PRD: 404 → “文件不存在”，其他错误 → “加载失败：{detail}”
      const msg = String(error?.message || '');
      if (msg.includes('资源不存在') || msg.includes('404')) {
        toast.error('文件不存在');
      } else {
        toast.error(msg || '加载失败');
      }
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [fileId, router]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  const performSave = useCallback(async (source: 'manual' | 'auto') => {
    if (!dirty) return;
    if (saving) {
      if (source === 'auto') {
        pendingAutoSaveRef.current = true;
      }
      return;
    }

    setSaving(true);
    try {
      const serialized = adapter.serialize();
      const contentStr = JSON.stringify(serialized);

      await fileApi.update(fileId, { content: contentStr });
      adapter.markSaved();
      setLastSavedAt(Math.floor(Date.now() / 1000));
      if (source === 'manual') {
        toast.success('保存成功');
      }
    } catch (error: any) {
      toast.error(error.message || (source === 'auto' ? '自动保存失败' : '保存失败'));
    } finally {
      setSaving(false);
      if (!isMountedRef.current) return;
      if (pendingAutoSaveRef.current) {
        pendingAutoSaveRef.current = false;
        // "last change wins": schedule one more save quickly
        window.setTimeout(() => {
          performSave('auto');
        }, 200);
      }
    }
  }, [adapter, dirty, fileId, saving]);

  const handleSave = async () => {
    await performSave('manual');
  };

  const handleBack = () => {
    if (dirty) {
      setShowLeaveDialog(true);
    } else {
      router.push('/');
    }
  };

  const handleConfirmLeave = () => {
    setShowLeaveDialog(false);
    router.push(pendingNavigation || '/');
  };

  // Auto-save: debounce 1.5s after dirty change
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!dirty) return;

    autoSaveTimerRef.current = window.setTimeout(() => {
      performSave('auto');
    }, 1500);
  }, [dirty, performSave]);

  const saveStatusText = (() => {
    if (saving) return '自动保存中...';
    if (dirty) return '未保存';
    if (lastSavedAt) {
      const d = new Date(lastSavedAt * 1000);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `已保存（${hh}:${mm}）`;
    }
    return '';
  })();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
            <h1 className="text-lg font-semibold">
              {fileName}.excalidraw
              {saveStatusText ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">{saveStatusText}</span>
              ) : null}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>

        {/* Excalidraw Canvas */}
        <div className="flex-1 overflow-hidden">
          <ExcalidrawWrapper
            initialContent={content}
            theme="light"
            adapter={adapter}
            onDirtyChange={setDirty}
          />
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认离开</AlertDialogTitle>
            <AlertDialogDescription>
              有未保存的更改，确定要离开吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>离开</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
