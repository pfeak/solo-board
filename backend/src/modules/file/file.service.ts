/**
 * File module: business logic.
 */

import prismaPkg from '@prisma/client';
import { generateUUID } from '../../lib/uuid.js';
import { getCurrentTimestamp } from '../../lib/time.js';
import { NotFoundError, ConflictError, BusinessError } from '../../core/errors.js';

const { PrismaClient } = prismaPkg;

export interface FileItem {
  id: string;
  folder_id: string | null;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface FileDetail extends FileItem {
  content: string;
}

export interface FileListResult {
  total: number;
  page: number;
  page_size: number;
  items: FileItem[];
}

export class FileService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get file list with pagination.
   */
  async getFiles(
    folderId: string | null = null,
    search?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<FileListResult> {
    const where: any = {};
    if (folderId !== null) {
      where.folderId = folderId;
    } else {
      where.folderId = null;
    }

    if (search) {
      where.name = {
        contains: search,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.file.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          folderId: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.file.count({ where }),
    ]);

    return {
      total,
      page,
      page_size: pageSize,
      items: items.map((f: { id: string; folderId: string | null; name: string; createdAt: number; updatedAt: number }) => ({
        id: f.id,
        folder_id: f.folderId,
        name: f.name,
        created_at: f.createdAt,
        updated_at: f.updatedAt,
      })),
    };
  }

  /**
   * Get file by ID with content.
   */
  async getFileById(fileId: string): Promise<FileDetail> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    return {
      id: file.id,
      folder_id: file.folderId,
      name: file.name,
      content: file.content,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
    };
  }

  /**
   * Create file.
   */
  async createFile(
    folderId: string | null,
    name: string,
    content: string = '{}',
    adminId?: string,
  ): Promise<FileItem> {
    // Validate name
    if (!name || name.trim().length === 0) {
      throw new BusinessError('File name cannot be empty', 400);
    }

    // PRD constraint: files must belong to a real folder (no root-level files).
    if (!folderId) {
      throw new BusinessError('Please select a folder first', 400);
    }

    // Check if folder exists
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true },
    });
    if (!folder) {
      throw new NotFoundError('Folder', folderId);
    }

    // Check for duplicate name in same folder
    // NOTE: `findUnique` with a compound unique key does not accept `null` values.
    // Since `folderId` is nullable (root-level files), use `findFirst` here.
    const existing = await this.prisma.file.findFirst({
      where: {
        folderId: folderId || null,
        name: name.trim(),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictError('A file with the same name already exists');
    }

    const now = getCurrentTimestamp();
    const file = await this.prisma.file.create({
      data: {
        id: generateUUID(),
        folderId: folderId || null,
        name: name.trim(),
        content,
        createdAt: now,
        updatedAt: now,
        createdBy: adminId || null,
      },
    });

    return {
      id: file.id,
      folder_id: file.folderId,
      name: file.name,
      created_at: file.createdAt,
      updated_at: file.updatedAt,
    };
  }

  /**
   * Update file (name, content, or folder).
   */
  async updateFile(
    fileId: string,
    updates: { name?: string; content?: string; folder_id?: string | null },
  ): Promise<FileItem> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    // PRD constraint: files must belong to a real folder (no moving to root).
    if (updates.folder_id !== undefined) {
      if (!updates.folder_id) {
        throw new BusinessError('Please select a folder first', 400);
      }
      const folder = await this.prisma.folder.findUnique({
        where: { id: updates.folder_id },
        select: { id: true },
      });
      if (!folder) {
        throw new NotFoundError('Target folder', updates.folder_id);
      }
    }

    // Check for duplicate name if renaming or moving
    if (updates.name || updates.folder_id !== undefined) {
      const newFolderId = updates.folder_id !== undefined ? updates.folder_id : file.folderId;
      const newName = updates.name ? updates.name.trim() : file.name;

      // Same reason as `createFile`: allow nullable folderId.
      const existing = await this.prisma.file.findFirst({
        where: {
          folderId: newFolderId || null,
          name: newName,
        },
        select: { id: true },
      });

      if (existing && existing.id !== fileId) {
        throw new ConflictError('A file with the same name already exists');
      }
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        ...(updates.name && { name: updates.name.trim() }),
        ...(updates.content !== undefined && { content: updates.content }),
        ...(updates.folder_id !== undefined && { folderId: updates.folder_id || null }),
        updatedAt: getCurrentTimestamp(),
      },
    });

    return {
      id: updated.id,
      folder_id: updated.folderId,
      name: updated.name,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    };
  }

  /**
   * Delete file.
   */
  async deleteFile(fileId: string): Promise<void> {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundError('File', fileId);
    }

    await this.prisma.file.delete({
      where: { id: fileId },
    });
  }
}
