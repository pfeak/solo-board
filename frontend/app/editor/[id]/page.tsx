'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { ExcalidrawWrapper } from '@/components/editor/ExcalidrawWrapper';
import { Button } from '@/components/ui/button';
import { fileApi } from '@/lib/api';
import { createExcalidrawAdapter } from '@/lib/excalidraw/adapter';
import { toast } from 'sonner';
import { Save, ArrowLeft } from 'lucide-react';
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

  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    loadFile();
  }, [fileId]);

  const loadFile = async () => {
    setLoading(true);
    try {
      const file = await fileApi.getById(fileId);
      setFileName(file.name);
      setContent(file.content || '{}');
    } catch (error: any) {
      toast.error(error.message || '加载失败');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dirty) {
      toast.info('没有未保存的更改');
      return;
    }

    setSaving(true);
    try {
      const adapter = createExcalidrawAdapter();
      const serialized = adapter.serialize();
      const contentStr = JSON.stringify(serialized);

      await fileApi.update(fileId, { content: contentStr });
      adapter.markSaved();
      toast.success('保存成功');
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
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

  // Auto-save (every 30 seconds if dirty)
  useEffect(() => {
    if (!dirty) return;

    const interval = setInterval(() => {
      handleSave();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [dirty]);

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
              {fileName}.excalidraw {dirty && <span className="text-muted-foreground">*</span>}
            </h1>
          </div>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>

        {/* Excalidraw Canvas */}
        <div className="flex-1 overflow-hidden">
          <ExcalidrawWrapper
            initialContent={content}
            theme="light"
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
