'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { folderApi, fileApi, type FolderItem, type FileItem } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { Folder, FolderOpen, FileImage, MoreVertical, Trash2, Edit2, ArrowRightLeft, Upload, Plus } from 'lucide-react';
import { useLocale } from '@/components/LocaleProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BoardCardThumbnail } from '@/components/BoardCardThumbnail';

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatRelativeTime(
  timestamp: number,
  t: (key: string, params?: Record<string, string>) => string,
): string {
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
}

type NodeActionTarget =
  | { type: 'folder'; id: string; name: string; parent_id: string | null }
  | { type: 'file'; id: string; name: string; folder_id: string | null };

export default function HomePage() {
  const router = useRouter();
  const { t } = useLocale();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [filesLoading, setFilesLoading] = useState(true);

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NodeActionTarget | null>(null);

  const [renameTarget, setRenameTarget] = useState<NodeActionTarget | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveTarget, setMoveTarget] = useState<NodeActionTarget | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const folderTree = await folderApi.getTree();
      // 仅使用顶层目录（一级），不展示子级
      setFolders(folderTree);
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.loadFailed'), t));
    } finally {
      setTreeLoading(false);
    }
  }, [t]);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      if (!currentFolderId) {
        setFiles([]);
        return;
      }
      const fileList = await fileApi.getList({ folder_id: currentFolderId });
      setFiles(fileList.items);
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.loadFailed'), t));
    } finally {
      setFilesLoading(false);
    }
  }, [currentFolderId, t]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (folders.length > 0 && currentFolderId === null) {
      setCurrentFolderId(folders[0].id);
    }
  }, [folders]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const folderSelectOptionsForFile = useMemo(() => {
    return folders.map((f) => ({ id: f.id, label: f.name }));
  }, [folders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error(t('home.validationFolderNameEmpty'));
      return;
    }
    try {
      await folderApi.create(newFolderName.trim(), null);
      toast.success(t('home.createSuccess'));
      setCreateFolderOpen(false);
      setNewFolderName('');
      await loadTree();
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.createFailed'), t));
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast.error(t('home.validationFileNameEmpty'));
      return;
    }
    const folderId = currentFolderId;
    if (!folderId) {
      toast.error(t('home.validationSelectFolder'));
      return;
    }

    try {
      const file = await fileApi.create(newFileName.trim(), folderId);
      toast.success(t('home.createSuccess'));
      setCreateFileOpen(false);
      setNewFileName('');
      router.push(`/editor/${file.id}`);
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.createFailed'), t));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'folder') {
        await folderApi.delete(deleteTarget.id);
      } else {
        await fileApi.delete(deleteTarget.id);
      }
      toast.success(t('home.deleteSuccess'));
      setDeleteTarget(null);
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.deleteFailed'), t));
    }
  };

  const handleOpenRename = (target: NodeActionTarget) => {
    setRenameTarget(target);
    setRenameValue(target.name);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error(renameTarget.type === 'folder' ? t('home.validationFolderNameEmpty') : t('home.validationFileNameEmpty'));
      return;
    }
    try {
      if (renameTarget.type === 'folder') {
        await folderApi.update(renameTarget.id, { name });
      } else {
        await fileApi.update(renameTarget.id, { name });
      }
      toast.success(t('home.renameSuccess'));
      setRenameTarget(null);
      setRenameValue('');
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.renameFailed'), t));
    }
  };

  const handleOpenMove = (target: NodeActionTarget) => {
    setMoveTarget(target);
    if (target.type === 'folder') {
      setMoveToFolderId(null);
    } else {
      setMoveToFolderId(target.folder_id);
    }
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    if (moveTarget.type === 'file' && !moveToFolderId) {
      toast.error(t('home.validationSelectTarget'));
      return;
    }
    try {
      if (moveTarget.type === 'folder') {
        await folderApi.update(moveTarget.id, { parent_id: null });
      } else {
        await fileApi.update(moveTarget.id, { folder_id: moveToFolderId });
      }
      toast.success(t('home.moveSuccess'));
      setMoveTarget(null);
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.moveFailed'), t));
    }
  };

  const handleOpenFile = (fileId: string) => {
    router.push(`/editor/${fileId}`);
  };

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    if (!currentFolderId) {
      toast.error(t('home.importSelectFolder'));
      return;
    }
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.excalidraw')) {
      toast.error(t('home.importInvalidFile'));
      return;
    }
    if (!currentFolderId) {
      toast.error(t('home.importSelectFolder'));
      return;
    }
    try {
      const text = await file.text();
      let content = '{}';
      try {
        const parsed = JSON.parse(text);
        content = typeof parsed === 'object' ? JSON.stringify(parsed) : text;
      } catch {
        content = text;
      }
      const baseName = file.name.replace(/\.excalidraw$/i, '').trim() || t('home.defaultImportedName');
      const fileItem = await fileApi.create(baseName, currentFolderId, content);
      toast.success(t('home.importSuccess'));
      await loadFiles();
      router.push(`/editor/${fileItem.id}`);
    } catch (error: any) {
      toast.error(getErrorMessage(error, t('home.importFailed'), t));
    }
  };

  const FolderRow = ({ node }: { node: FolderItem }) => {
    const selected = currentFolderId === node.id;
    const FolderIcon = selected ? FolderOpen : Folder;
    return (
      <div className="group flex items-center gap-1">
        <Button
          variant={selected ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 flex-1 justify-start"
          onClick={() => setCurrentFolderId(node.id)}
        >
          <FolderIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{node.name}</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 px-0 opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={t('home.folderActions')}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenRename({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}>
              <Edit2 className="mr-2 h-4 w-4" />
              {t('home.rename')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenMove({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              {t('home.move')}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteTarget({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('home.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex min-h-0 h-full w-full flex-1 flex-row">
        {/* Folder Tree */}
        <div className="w-64 shrink-0 border-r border-border bg-card/80 p-4 backdrop-blur-sm overflow-auto">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('home.workspace')}</h2>
          </div>

          {treeLoading ? (
            <p className="text-sm text-muted-foreground">{t('home.loading')}</p>
          ) : (
            <div className="space-y-1">
              {folders.map((folder) => (
                <FolderRow key={folder.id} node={folder} />
              ))}
            </div>
          )}
        </div>

        {/* File List */}
        <div className="min-h-0 flex-1 overflow-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              {currentFolderId ? folders.find((f) => f.id === currentFolderId)?.name ?? t('home.appName') : t('home.appName')}
            </h1>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".excalidraw"
                className="hidden"
                onChange={handleImportFile}
                aria-label={t('home.import')}
              />
              <Button variant="outline" onClick={handleImportClick} disabled={!currentFolderId} title={t('home.importDesc')}>
                <Upload className="mr-2 h-4 w-4" />
                {t('home.import')}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('home.new')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
                    <Folder className="mr-2 h-4 w-4" />
                    {t('home.newFolder')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCreateFileOpen(true)}>
                    <FileImage className="mr-2 h-4 w-4" />
                    {t('home.newBoard')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {filesLoading ? (
            <p className="text-muted-foreground">{t('home.loading')}</p>
          ) : !currentFolderId ? (
            <p className="text-muted-foreground">{t('home.noFolderSelected')}</p>
          ) : files.length === 0 ? (
            <p className="text-muted-foreground">{t('home.noFiles')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {files.map((file) => (
                <div
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => handleOpenFile(file.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenFile(file.id);
                    }
                  }}
                >
                  <div className="relative w-full overflow-hidden bg-muted/30">
                    <BoardCardThumbnail fileId={file.id} className="w-full" />
                    <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {formatRelativeTime(file.updated_at, t)}
                    </span>
                    <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 rounded-full shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label={t('home.actions')}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenRename({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id }); }}>
                            <Edit2 className="mr-2 h-4 w-4" />
                            {t('home.rename')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenMove({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id }); }}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />
                            {t('home.move')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id }); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('home.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-3">
                    <h3 className="truncate font-semibold leading-tight">
                      {file.name.replace(/\.excalidraw$/i, '') || file.name}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('home.createFolder')}</DialogTitle>
            <DialogDescription>{t('home.createFolderDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">{t('home.folderName')}</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={t('home.placeholderFolderName')}
                className="placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateFolderOpen(false)}>
              {t('home.cancel')}
            </Button>
            <Button onClick={handleCreateFolder}>{t('home.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create File Dialog */}
      <Dialog open={createFileOpen} onOpenChange={setCreateFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('home.createFile')}</DialogTitle>
            <DialogDescription>{t('home.createFileDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">{t('home.boardName')}</Label>
              <Input
                id="file-name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={t('home.placeholderBoardName')}
                className="placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateFileOpen(false)}>
              {t('home.cancel')}
            </Button>
            <Button onClick={handleCreateFile}>{t('home.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameTarget?.type === 'folder' ? t('home.renameFolder') : t('home.renameFile')}</DialogTitle>
            <DialogDescription>{t('home.renameDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-value">{t('home.name')}</Label>
            <Input
              id="rename-value"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t('home.placeholderName')}
              className="placeholder:text-muted-foreground/60"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              {t('home.cancel')}
            </Button>
            <Button onClick={handleRename}>{t('home.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveTarget?.type === 'folder' ? t('home.moveFolder') : t('home.moveFile')}</DialogTitle>
            <DialogDescription>{t('home.moveDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="move-target">{t('home.targetFolder')}</Label>
            {moveTarget?.type === 'file' ? (
              <select
                id="move-target"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={moveToFolderId ?? ''}
                onChange={(e) => setMoveToFolderId(e.target.value || null)}
              >
                <option value="">{t('home.optionSelectFolder')}</option>
                {folderSelectOptionsForFile.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-muted-foreground">{t('home.moveFolderToRoot')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMoveTarget(null)}>
              {t('home.cancel')}
            </Button>
            <Button onClick={handleMove}>{t('home.move')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('home.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === 'folder'
                ? t('home.deleteFolderConfirm', { name: deleteTarget?.name ?? '' })
                : t('home.deleteFileConfirm', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('home.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('home.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
