'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { ExcalidrawWrapper } from '@/components/editor/ExcalidrawWrapper';
import { Button } from '@/components/ui/button';
import { fileApi } from '@/lib/api';
import { createExcalidrawAdapter } from '@/lib/excalidraw/adapter';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { ArrowLeft, Loader2, FileImage } from 'lucide-react';
import { BoardCardThumbnail } from '@/components/BoardCardThumbnail';
import { cn } from '@/lib/utils';
import { useLocale } from '@/components/LocaleProvider';
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
  const { t } = useLocale();
  const fileId = params.id as string;

  const adapter = useMemo(() => createExcalidrawAdapter(), []);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pendingAutoSaveRef = useRef(false);
  const isMountedRef = useRef(true);
  const lastFolderIdRef = useRef<string | null>(null);

  const [currentFileId, setCurrentFileId] = useState<string>(fileId);
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [allBoards, setAllBoards] = useState<Array<{ id: string; name: string; updated_at: number; created_at: number }>>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [pendingBoardId, setPendingBoardId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const loadFile = useCallback(async (targetFileId?: string, skipBoardsList = false) => {
    const idToLoad = targetFileId || currentFileId;
    setLoading(true);
    try {
      const file = await fileApi.getById(idToLoad);
      setFileName(file.name);
      const folderChanged = file.folder_id !== lastFolderIdRef.current;
      setFolderId(file.folder_id);
      lastFolderIdRef.current = file.folder_id;
      setContent(file.content || '{}');
      setDirty(false);
      setLastSavedAt(null);

      // Load all boards in the same folder (including current) - only reload if folder changed
      if (!skipBoardsList && file.folder_id) {
        if (folderChanged) {
          try {
            const fileList = await fileApi.getList({ folder_id: file.folder_id });
            const allFiles = fileList.items
              .map((f) => ({
                id: f.id,
                name: f.name.replace(/\.excalidraw$/i, '') || f.name,
                updated_at: f.updated_at,
                created_at: f.created_at,
              }))
              .sort((a, b) => b.created_at - a.created_at); // Sort by created_at descending
            setAllBoards(allFiles);
          } catch {
            // Ignore errors when loading boards
            setAllBoards([]);
          }
        }
      } else if (!file.folder_id) {
        setAllBoards([]);
        lastFolderIdRef.current = null;
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('editor.loadFailed'), t));
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [currentFileId, router, t]);

  // Sync currentFileId with URL fileId (only when URL actually changes, e.g., direct navigation or refresh)
  useEffect(() => {
    if (fileId !== currentFileId) {
      setCurrentFileId(fileId);
    }
  }, [fileId]);

  // Load file when currentFileId changes
  useEffect(() => {
    loadFile(currentFileId);
  }, [currentFileId, loadFile]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^\/editor\/([^/]+)$/);
      if (match && match[1] !== currentFileId) {
        setCurrentFileId(match[1]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentFileId]);

  const performSave = useCallback(
    async (source: 'manual' | 'auto') => {
      // 避免在画板内容尚未从服务端加载完成时触发保存，防止用空白状态覆盖真实数据
      if (loading) return;
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

        await fileApi.update(currentFileId, { content: contentStr });
        adapter.markSaved();
        setLastSavedAt(Math.floor(Date.now() / 1000));
        if (source === 'manual') {
          toast.success(t('editor.saveSuccess'));
        }
      } catch (error: any) {
        toast.error(
          getErrorMessage(
            error,
            source === 'auto' ? t('editor.autoSaveFailed') : t('editor.saveFailed'),
            t,
          ),
        );
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
    },
    [adapter, dirty, currentFileId, saving, t, loading],
  );

  const handleBack = () => {
    if (dirty) {
      setShowLeaveDialog(true);
    } else {
      router.push('/');
    }
  };

  const formatRelativeTime = (
    timestamp: number,
    t: (key: string, params?: Record<string, string>) => string,
  ): string => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return t('home.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes === 1 ? t('home.minuteAgo') : t('home.minutesAgo', { n: String(minutes) });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours === 1 ? t('home.hourAgo') : t('home.hoursAgo', { n: String(hours) });
    const days = Math.floor(hours / 24);
    if (days < 30) return days === 1 ? t('home.dayAgo') : t('home.daysAgo', { n: String(days) });
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? t('home.monthAgo') : t('home.monthsAgo', { n: String(months) });
    const years = Math.floor(months / 12);
    return years === 1 ? t('home.yearAgo') : t('home.yearsAgo', { n: String(years) });
  };

  const handleConfirmLeave = async () => {
    setShowLeaveDialog(false);
    const target = pendingNavigation;
    setPendingNavigation(null);
    // 统一使用 Next.js 路由进行导航，避免手动修改 history 导致状态不同步
    router.push(target || '/');
  };

  // 当存在待切换的画板时，确保当前画板完成保存后再切换，避免内容被清空
  useEffect(() => {
    if (!pendingBoardId) return;
    if (saving || dirty) return;

    const targetId = pendingBoardId;
    setPendingBoardId(null);

    // 使用 Next.js 路由跳转到新画板，保证与首页进入画板的行为一致（完全按路由参数重新加载）
    router.push(`/editor/${targetId}`);
  }, [pendingBoardId, saving, dirty, router]);

  // Auto-save: debounce 400ms after each change (save after every board operation)
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!dirty) return;

    autoSaveTimerRef.current = window.setTimeout(() => {
      performSave('auto');
    }, 400);
  }, [dirty, performSave]);

  const saveStatusText = (() => {
    if (saving) return t('editor.autoSaving');
    if (dirty) return t('editor.unsaved');
    if (lastSavedAt) {
      const d = new Date(lastSavedAt * 1000);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return t('editor.savedAt', { time: `${hh}:${mm}` });
    }
    return '';
  })();

  const displayFileName = fileName.replace(/\.excalidraw$/i, '') || fileName;

  const editorSidebar = (
    <div className="sticky top-0 flex h-screen w-64 flex-col border-r border-border bg-card shadow-sm">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm">
        <span className="text-lg font-semibold text-foreground">Solo-Board</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-4 overflow-y-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          className="justify-between group w-full hover:bg-accent/50 transition-colors" 
          onClick={handleBack}
        >
          <div className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>{t('editor.back')}</span>
          </div>
        </Button>

        {/* 切换画板时的保存等待提示 */}
        {pendingBoardId && (
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{saveStatusText || t('editor.autoSaving')}</span>
          </div>
        )}

        {/* All boards in the same folder */}
        {allBoards.length > 0 && (
          <div className="flex flex-col gap-2">
            {allBoards.map((board) => {
              const isPending = pendingBoardId === board.id;
              const isActive = pendingBoardId ? board.id === pendingBoardId : board.id === currentFileId;
              const isDisabled = !!pendingBoardId && !isActive;
              return (
                <button
                  key={board.id}
                  className={cn(
                    'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                    'hover:border-primary/50 hover:shadow-sm',
                    isActive
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card'
                    ,
                    isPending && 'opacity-80 cursor-wait',
                    isDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    if (board.id === currentFileId && !pendingBoardId) return; // Don't navigate to current board when not switching

                    // 如果当前没有未保存内容且未在保存中，直接切换
                    if (!dirty && !saving) {
                      router.push(`/editor/${board.id}`);
                      return;
                    }

                    // 有未保存内容或正在保存中：先保存当前画板，保存完成后再自动切换
                    setPendingBoardId(board.id);
                    if (!saving && dirty) {
                      // 触发一次自动保存；具体等待逻辑由上面的 effect 保证
                      performSave('auto');
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative w-full overflow-hidden rounded border border-border bg-muted/30">
                    <BoardCardThumbnail fileId={board.id} className="w-full" />
                  </div>
                  {/* Title */}
                  <div className="flex flex-col gap-0.5">
                    <span className={cn(
                      'text-sm font-semibold leading-tight line-clamp-2',
                    isActive ? 'text-primary' : 'text-foreground'
                    )}>
                      {board.name}
                    </span>
                    {/* Time */}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(board.updated_at, t)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {allBoards.length === 0 && folderId && (
          <div className="text-xs text-muted-foreground">
            {t('editor.noOtherBoards')}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">{t('editor.loading')}</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout sidebarReplacement={editorSidebar}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile: top bar with back only (auto-save, no manual save button) */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2 lg:hidden">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('editor.back')}
          </Button>
          {saveStatusText ? (
            <span className="text-xs text-muted-foreground">{saveStatusText}</span>
          ) : null}
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ExcalidrawWrapper
            initialContent={content}
            theme="light"
            adapter={adapter}
            onDirtyChange={setDirty}
          />
          {pendingBoardId && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <Loader2 className="mb-3 h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {saveStatusText || t('editor.autoSaving')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editor.leaveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('editor.leaveMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('home.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>{t('editor.leave')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
