/**
 * Folder module: business logic.
 */

import prismaPkg from '@prisma/client';
import { generateUUID } from '../../lib/uuid.js';
import { getCurrentTimestamp } from '../../lib/time.js';
import { NotFoundError, ConflictError, BusinessError } from '../../core/errors.js';

const { PrismaClient } = prismaPkg;

export interface FolderTreeItem {
  id: string;
  parent_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
  children?: FolderTreeItem[];
}

export class FolderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Max folder depth is 2:
   * - depth 1: parentId = null
   * - depth 2: parentId = depth 1 folder
   */
  private async getFolderDepth(folderId: string): Promise<1 | 2> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { parentId: true },
    });
    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }
    return folder.parentId ? 2 : 1;
  }

  /**
   * Get folder tree (recursive).
   */
  async getFolderTree(parentId: string | null = null): Promise<FolderTreeItem[]> {
    const folders = await this.prisma.folder.findMany({
      where: { parentId },
      orderBy: { name: 'asc' },
    });

    const result: FolderTreeItem[] = folders.map((f: { id: string; parentId: string | null; name: string; createdAt: number; updatedAt: number }) => ({
      id: f.id,
      parent_id: f.parentId,
      name: f.name,
      created_at: f.createdAt,
      updated_at: f.updatedAt,
    }));

    // Recursively load children
    for (const folder of result) {
      folder.children = await this.getFolderTree(folder.id);
    }

    return result;
  }

  /**
   * Get folder by ID.
   */
  async getFolderById(folderId: string): Promise<FolderTreeItem> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }

    return {
      id: folder.id,
      parent_id: folder.parentId,
      name: folder.name,
      created_at: folder.createdAt,
      updated_at: folder.updatedAt,
    };
  }

  /**
   * Create folder.
   */
  async createFolder(
    parentId: string | null,
    name: string,
    adminId?: string,
  ): Promise<FolderTreeItem> {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new BusinessError('文件夹名称不能为空', 400);
    }

    // PRD constraint: max depth 2. Only allow creating:
    // - level-1: parentId = null
    // - level-2: parentId = level-1 folder
    if (parentId) {
      const depth = await this.getFolderDepth(parentId);
      if (depth === 2) {
        throw new BusinessError('最多只能创建两级目录', 400);
      }
    }

    // Check for duplicate name in same parent
    const existing = await this.prisma.folder.findFirst({
      where: {
        parentId: parentId || null,
        name: name.trim(),
      },
    });

    if (existing) {
      throw new ConflictError('同目录下已存在同名文件夹');
    }

    const now = getCurrentTimestamp();
    const folder = await this.prisma.folder.create({
      data: {
        id: generateUUID(),
        parentId: parentId || null,
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        createdBy: adminId || null,
      },
    });

    return {
      id: folder.id,
      parent_id: folder.parentId,
      name: folder.name,
      created_at: folder.createdAt,
      updated_at: folder.updatedAt,
    };
  }

  /**
   * Update folder (rename or move).
   */
  async updateFolder(
    folderId: string,
    updates: { name?: string; parent_id?: string | null },
  ): Promise<FolderTreeItem> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }

    // Prevent moving folder into itself or its descendants
    if (updates.parent_id) {
      if (updates.parent_id === folderId) {
        throw new BusinessError('不能将文件夹移动到自身', 400);
      }

      // Check if target is a descendant
      const isDescendant = await this.isDescendant(folderId, updates.parent_id);
      if (isDescendant) {
        throw new BusinessError('不能将文件夹移动到其子目录中', 400);
      }

      // Check if target exists
      const target = await this.prisma.folder.findUnique({
        where: { id: updates.parent_id },
      });
      if (!target) {
        throw new NotFoundError('Target folder', updates.parent_id);
      }

      // PRD constraint: max depth 2
      // Moving under a depth-2 folder would create depth-3.
      const targetDepth = await this.getFolderDepth(updates.parent_id);
      if (targetDepth === 2) {
        throw new BusinessError('最多只能创建两级目录', 400);
      }

      // If moving a folder that has children under another folder (making it depth-2),
      // its children would become depth-3, which is not allowed.
      const childrenCount = await this.prisma.folder.count({ where: { parentId: folderId } });
      if (childrenCount > 0) {
        throw new BusinessError('包含子目录的文件夹不能移动到其他文件夹下', 400);
      }
    }

    // Check for duplicate name if renaming
    if (updates.name) {
      const newParentId = updates.parent_id !== undefined ? updates.parent_id : folder.parentId;
      const existing = await this.prisma.folder.findFirst({
        where: {
          parentId: newParentId || null,
          name: updates.name.trim(),
        },
      });

      if (existing && existing.id !== folderId) {
        throw new ConflictError('同目录下已存在同名文件夹');
      }
    }

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.parent_id !== undefined && { parentId: updates.parent_id || null }),
        updatedAt: getCurrentTimestamp(),
      },
    });

    return {
      id: updated.id,
      parent_id: updated.parentId,
      name: updated.name,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  }

  /**
   * Delete folder (only if empty).
   */
  async deleteFolder(folderId: string): Promise<void> {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        children: true,
        files: true,
      },
    });

    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }

    if (folder.children.length > 0 || folder.files.length > 0) {
      throw new BusinessError('文件夹不为空，无法删除', 400);
    }

    await this.prisma.folder.delete({
      where: { id: folderId },
    });
  }

  /**
   * Get folder children (folders and files).
   */
  async getFolderChildren(folderId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: { parentId: folderId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.file.findMany({
        where: { folderId },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      folders: folders.map((f: { id: string; name: string; createdAt: number; updatedAt: number }) => ({
        id: f.id,
        name: f.name,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
      })),
      files: files.map((f: { id: string; name: string; createdAt: number; updatedAt: number }) => ({
        id: f.id,
        name: f.name,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
      })),
    };
  }

  /**
   * Check if targetId is a descendant of folderId.
   */
  private async isDescendant(folderId: string, targetId: string): Promise<boolean> {
    const target = await this.prisma.folder.findUnique({
      where: { id: targetId },
    });

    if (!target || !target.parentId) {
      return false;
    }

    if (target.parentId === folderId) {
      return true;
    }

    return this.isDescendant(folderId, target.parentId);
  }
}
