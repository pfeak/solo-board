'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { folderApi, fileApi, type FolderItem, type FileItem } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Folder, FileImage, ChevronDown, ChevronRight, Trash2, Edit2, ArrowRightLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

type NodeActionTarget =
  | { type: 'folder'; id: string; name: string; parent_id: string | null }
  | { type: 'file'; id: string; name: string; folder_id: string | null };

export default function HomePage() {
  const router = useRouter();
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
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() => new Set());

  const [folderPanelCollapsed, setFolderPanelCollapsed] = useState(false);

  const isMac = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('solo-board.folderPanelCollapsed');
      if (raw === '1') setFolderPanelCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('solo-board.folderPanelCollapsed', folderPanelCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [folderPanelCollapsed]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(el?.isContentEditable);
      if (isEditable) return;

      // Folder panel toggle: Ctrl+Shift+D (Win/Linux) / ⌘⇧D (macOS) only on `/`
      const isToggle =
        (isMac && e.metaKey && e.shiftKey && !e.ctrlKey && (e.key === 'd' || e.key === 'D')) ||
        (!isMac && e.ctrlKey && e.shiftKey && !e.metaKey && (e.key === 'd' || e.key === 'D'));

      if (isToggle) {
        e.preventDefault();
        setFolderPanelCollapsed((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMac]);

  const loadTree = useCallback(async () => {
    setTreeLoading(true);
    try {
      const folderTree = await folderApi.getTree();
      setFolders(folderTree);
      setExpandedFolderIds((prev) => {
        if (prev.size > 0) return prev;
        const next = new Set(prev);
        for (const f of folderTree) next.add(f.id);
        return next;
      });
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      if (!currentFolderId) {
        // PRD: 根目录隐式存在且不允许挂文件，根目录下文件列表应为空。
        setFiles([]);
        return;
      }
      const fileList = await fileApi.getList({ folder_id: currentFolderId });
      setFiles(fileList.items);
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setFilesLoading(false);
    }
  }, [currentFolderId]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const folderIndex = useMemo(() => {
    const map = new Map<string, FolderItem>();
    const walk = (nodes: FolderItem[]) => {
      for (const n of nodes) {
        map.set(n.id, n);
        if (n.children?.length) walk(n.children);
      }
    };
    walk(folders);
    return map;
  }, [folders]);

  const breadcrumb = useMemo(() => {
    const chain: Array<{ id: string; name: string }> = [];
    if (!currentFolderId) return chain;
    const path: FolderItem[] = [];
    let cur: FolderItem | undefined = folderIndex.get(currentFolderId);
    while (cur) {
      path.unshift(cur);
      cur = cur.parent_id ? folderIndex.get(cur.parent_id) : undefined;
    }
    for (const p of path) chain.push({ id: p.id, name: p.name });
    return chain;
  }, [currentFolderId, folderIndex]);

  const folderDepth = useMemo(() => {
    const depth = new Map<string, 1 | 2>();
    for (const root of folders) {
      depth.set(root.id, 1);
      for (const child of root.children || []) {
        depth.set(child.id, 2);
      }
    }
    return depth;
  }, [folders]);

  const canCreateFolderInCurrent = useMemo(() => {
    if (!currentFolderId) return true; // root → create level-1 folder
    return folderDepth.get(currentFolderId) !== 2;
  }, [currentFolderId, folderDepth]);

  const folderSelectOptionsForCreate = useMemo(() => {
    // PRD: 新建文件夹父目录只能选 根（隐式）或一级目录
    const opts: Array<{ id: string | null; label: string }> = [{ id: null, label: '（顶层）' }];
    for (const f of folders) {
      opts.push({ id: f.id, label: f.name });
    }
    return opts;
  }, [folders]);

  const folderSelectOptionsForFile = useMemo(() => {
    // PRD: 文件必须挂在一级或二级目录下，不允许根目录
    const opts: Array<{ id: string; label: string }> = [];
    for (const f of folders) {
      opts.push({ id: f.id, label: f.name });
      for (const c of f.children || []) {
        opts.push({ id: c.id, label: `${f.name} / ${c.name}` });
      }
    }
    return opts;
  }, [folders]);

  const [createFolderParentId, setCreateFolderParentId] = useState<string | null>(null);
  const [createFileFolderId, setCreateFileFolderId] = useState<string | null>(null);

  useEffect(() => {
    // Default selections per PRD: default to current directory when valid.
    if (createFolderOpen) {
      if (!currentFolderId) {
        setCreateFolderParentId(null);
      } else if (folderDepth.get(currentFolderId) === 1) {
        setCreateFolderParentId(currentFolderId);
      } else {
        // current is level-2: fallback to its parent (level-1)
        const cur = folderIndex.get(currentFolderId);
        setCreateFolderParentId(cur?.parent_id || null);
      }
    }
    if (createFileOpen) {
      if (currentFolderId) {
        setCreateFileFolderId(currentFolderId);
      } else {
        // Root selected: keep null; user must choose a real folder
        setCreateFileFolderId(null);
      }
    }
  }, [createFolderOpen, createFileOpen, currentFolderId, folderDepth, folderIndex]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('文件夹名称不能为空');
      return;
    }
    if (!canCreateFolderInCurrent) {
      toast.error('最多只能创建两级目录');
      return;
    }

    try {
      await folderApi.create(newFolderName.trim(), createFolderParentId);
      toast.success('创建成功');
      setCreateFolderOpen(false);
      setNewFolderName('');
      await loadTree();
    } catch (error: any) {
      toast.error(error.message || '创建失败');
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast.error('文件名不能为空');
      return;
    }
    if (!createFileFolderId) {
      toast.error('请选择文件所在目录');
      return;
    }

    try {
      const file = await fileApi.create(newFileName.trim(), createFileFolderId);
      toast.success('创建成功');
      setCreateFileOpen(false);
      setNewFileName('');
      router.push(`/editor/${file.id}`);
    } catch (error: any) {
      toast.error(error.message || '创建失败');
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
      toast.success('删除成功');
      setDeleteTarget(null);
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
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
      toast.error(renameTarget.type === 'folder' ? '文件夹名称不能为空' : '文件名不能为空');
      return;
    }
    try {
      if (renameTarget.type === 'folder') {
        await folderApi.update(renameTarget.id, { name });
      } else {
        await fileApi.update(renameTarget.id, { name });
      }
      toast.success('重命名成功');
      setRenameTarget(null);
      setRenameValue('');
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || '重命名失败');
    }
  };

  const handleOpenMove = (target: NodeActionTarget) => {
    setMoveTarget(target);
    if (target.type === 'folder') {
      setMoveToFolderId(target.parent_id);
    } else {
      setMoveToFolderId(target.folder_id);
    }
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    // PRD: 文件不能移动到根目录（folder_id = null）
    if (moveTarget.type === 'file' && !moveToFolderId) {
      toast.error('不允许移动到顶层');
      return;
    }
    if (moveTarget.type === 'folder' && !moveToFolderId) {
      toast.error('请选择父目录');
      return;
    }
    try {
      if (moveTarget.type === 'folder') {
        await folderApi.update(moveTarget.id, { parent_id: moveToFolderId });
      } else {
        await fileApi.update(moveTarget.id, { folder_id: moveToFolderId });
      }
      toast.success('移动成功');
      setMoveTarget(null);
      await loadTree();
      await loadFiles();
    } catch (error: any) {
      toast.error(error.message || '移动失败');
    }
  };

  const handleOpenFile = (fileId: string) => {
    router.push(`/editor/${fileId}`);
  };

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const FolderNode = ({ node, depth }: { node: FolderItem; depth: number }) => {
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const expanded = expandedFolderIds.has(node.id);
    const selected = currentFolderId === node.id;

    return (
      <div>
        <div className="group flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 px-0"
            aria-label={expanded ? '折叠' : '展开'}
            onClick={() => hasChildren && toggleFolderExpanded(node.id)}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant={selected ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 flex-1 justify-start"
            style={{ paddingLeft: Math.max(8, depth * 12) }}
            onClick={() => setCurrentFolderId(node.id)}
          >
            <Folder className="mr-2 h-4 w-4" />
            <span className="truncate">{node.name}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 px-0 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="文件夹操作"
              >
                <Plus className="h-4 w-4 rotate-45" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenRename({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}>
                <Edit2 className="mr-2 h-4 w-4" />
                重命名
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleOpenMove({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                移动
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteTarget({ type: 'folder', id: node.id, name: node.name, parent_id: node.parent_id })}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && expanded ? (
          <div className="ml-4 border-l border-border pl-2">
            {node.children!.map((c) => (
              <FolderNode key={c.id} node={c} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex h-full">
        {/* Folder Tree */}
        <div
          className={
            folderPanelCollapsed
              ? 'flex w-12 flex-col items-center border-r border-border bg-card/80 p-2 backdrop-blur-sm'
              : 'w-64 border-r border-border bg-card/80 p-4 backdrop-blur-sm'
          }
        >
          <div className={folderPanelCollapsed ? 'flex flex-col items-center gap-2' : 'mb-3 flex items-center justify-between'}>
            {folderPanelCollapsed ? null : <h2 className="text-lg font-semibold">目录</h2>}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={folderPanelCollapsed ? '展开目录面板' : '折叠目录面板'}
              onClick={() => setFolderPanelCollapsed((v) => !v)}
            >
              {folderPanelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {folderPanelCollapsed ? null : treeLoading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-1">
              {/* PRD: 不展示“根目录”节点；顶层文件夹视为一级目录 */}
              {folders.map((folder) => (
                <FolderNode key={folder.id} node={folder} depth={0} />
              ))}
            </div>
          )}
        </div>

        {/* File List */}
        <div className="flex-1 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold">文件浏览</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  新建
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    if (!canCreateFolderInCurrent) {
                      toast.error('最多只能创建两级目录');
                      return;
                    }
                    setCreateFolderOpen(true);
                  }}
                  disabled={!canCreateFolderInCurrent}
                >
                  <Folder className="mr-2 h-4 w-4" />
                  新建文件夹
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCreateFileOpen(true)}>
                  <FileImage className="mr-2 h-4 w-4" />
                  新建画板
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Breadcrumb */}
          {breadcrumb.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumb.map((b, idx) => (
                <div key={`${b.id}-${idx}`} className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                    onClick={() => setCurrentFolderId(b.id)}
                  >
                    {b.name}
                  </Button>
                  {idx < breadcrumb.length - 1 ? <span>/</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {filesLoading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : !currentFolderId ? (
            <p className="text-muted-foreground">请选择一个目录以查看文件</p>
          ) : files.length === 0 ? (
            <p className="text-muted-foreground">当前目录下没有文件</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">类型</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">修改时间</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <FileImage className="mr-2 h-4 w-4" />
                          {file.name}.excalidraw
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">画板</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatTimestamp(file.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenFile(file.id)}
                          >
                            打开
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                操作
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenRename({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id })}>
                                <Edit2 className="mr-2 h-4 w-4" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenMove({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id })}>
                                <ArrowRightLeft className="mr-2 h-4 w-4" />
                                移动
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name, folder_id: file.folder_id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建文件夹</DialogTitle>
            <DialogDescription>创建一级或二级文件夹（最多两级）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">文件夹名称</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="请输入文件夹名称"
                className="placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-parent">父目录</Label>
              <select
                id="folder-parent"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={createFolderParentId ?? ''}
                onChange={(e) => setCreateFolderParentId(e.target.value ? e.target.value : null)}
              >
                {folderSelectOptionsForCreate.map((opt) => (
                  <option key={opt.id ?? 'top'} value={opt.id ?? ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateFolderOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFolder}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create File Dialog */}
      <Dialog open={createFileOpen} onOpenChange={setCreateFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建画板</DialogTitle>
            <DialogDescription>画板必须创建在某个目录中（不允许顶层）</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-name">画板名称</Label>
              <Input
                id="file-name"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="请输入画板名称"
                className="placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-folder">所在目录</Label>
              <select
                id="file-folder"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={createFileFolderId ?? ''}
                onChange={(e) => setCreateFileFolderId(e.target.value || null)}
              >
                <option value="">请选择目录</option>
                {folderSelectOptionsForFile.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateFileOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFile}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{renameTarget?.type === 'folder' ? '重命名文件夹' : '重命名文件'}</DialogTitle>
            <DialogDescription>请输入新的名称</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-value">名称</Label>
            <Input
              id="rename-value"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入名称"
              className="placeholder:text-muted-foreground/60"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              取消
            </Button>
            <Button onClick={handleRename}>确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Dialog */}
      <Dialog open={!!moveTarget} onOpenChange={(open) => !open && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveTarget?.type === 'folder' ? '移动文件夹' : '移动文件'}</DialogTitle>
            <DialogDescription>选择目标目录</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="move-target">目标目录</Label>
            <select
              id="move-target"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={moveToFolderId ?? ''}
              onChange={(e) => setMoveToFolderId(e.target.value ? e.target.value : null)}
            >
              {moveTarget?.type === 'file' ? (
                <>
                  <option value="">请选择目录</option>
                  {folderSelectOptionsForFile.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </>
              ) : (
                <>
                  {/* PRD: 不展示“根目录”节点。这里允许选择“顶层”会违反该约束，因此仅允许选择一级目录作为父级。 */}
                  <option value="">请选择父目录</option>
                  {folders
                    .filter((opt) => opt.id !== moveTarget?.id)
                    .map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMoveTarget(null)}>
              取消
            </Button>
            <Button onClick={handleMove}>移动</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 {deleteTarget?.type === 'folder' ? '文件夹' : '文件'} &quot;{deleteTarget?.name}&quot; 吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
