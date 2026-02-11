'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { folderApi, fileApi, type FolderItem, type FileItem } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Folder, FileImage, Edit, Trash2, Move } from 'lucide-react';
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
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function HomePage() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFileOpen, setCreateFileOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [currentFolderId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [folderTree, fileList] = await Promise.all([
        folderApi.getTree(),
        fileApi.getList({ folder_id: currentFolderId || null }),
      ]);
      setFolders(folderTree);
      setFiles(fileList.items);
    } catch (error: any) {
      toast.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('文件夹名称不能为空');
      return;
    }

    try {
      await folderApi.create(newFolderName.trim(), currentFolderId);
      toast.success('创建成功');
      setCreateFolderOpen(false);
      setNewFolderName('');
      loadData();
    } catch (error: any) {
      toast.error(error.message || '创建失败');
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) {
      toast.error('文件名不能为空');
      return;
    }

    try {
      const file = await fileApi.create(newFileName.trim(), currentFolderId);
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
      loadData();
    } catch (error: any) {
      toast.error(error.message || '删除失败');
    }
  };

  const handleOpenFile = (fileId: string) => {
    router.push(`/editor/${fileId}`);
  };

  return (
    <MainLayout>
      <div className="flex h-full">
        {/* Folder Tree */}
        <div className="w-64 border-r border-border bg-card p-4">
          <h2 className="mb-4 text-lg font-semibold">目录</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : (
            <div className="space-y-1">
              <Button
                variant={currentFolderId === null ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                onClick={() => setCurrentFolderId(null)}
              >
                <Folder className="mr-2 h-4 w-4" />
                根目录
              </Button>
              {folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={currentFolderId === folder.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <Folder className="mr-2 h-4 w-4" />
                  {folder.name}
                </Button>
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
                <DropdownMenuItem onClick={() => setCreateFolderOpen(true)}>
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

          {loading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : files.length === 0 ? (
            <p className="text-muted-foreground">当前目录下没有文件</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-sm font-medium">名称</th>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
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
            <DialogDescription>在当前目录下创建新文件夹</DialogDescription>
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
            <DialogDescription>在当前目录下创建新画板文件</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateFileOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFile}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除 {deleteTarget?.type === 'folder' ? '文件夹' : '文件'} "{deleteTarget?.name}" 吗？此操作不可恢复。
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
