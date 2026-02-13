/**
 * Folder module: HTTP routes.
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { FolderService } from './folder.service.js';
import {
  getFoldersSchema,
  getFolderSchema,
  createFolderSchema,
  updateFolderSchema,
  deleteFolderSchema,
  getFolderChildrenSchema,
} from './folder.schema.js';

export async function registerFolderRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const folderService = new FolderService(prisma);

  // Get folder tree
  app.get<{
    Querystring: { parent_id?: string | null };
  }>('/api/folders', { schema: getFoldersSchema }, async (request) => {
    const parentId = request.query.parent_id || null;
    return folderService.getFolderTree(parentId);
  });

  // Get folder by ID
  app.get<{
    Params: { folder_id: string };
  }>('/api/folders/:folder_id', { schema: getFolderSchema }, async (request, reply) => {
    try {
      return await folderService.getFolderById(request.params.folder_id);
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Create folder
  app.post<{
    Body: { parent_id?: string | null; name: string };
  }>('/api/folders', { schema: createFolderSchema }, async (request, reply) => {
    const session = (request as any).session;
    try {
      const folder = await folderService.createFolder(
        request.body.parent_id || null,
        request.body.name,
        session?.adminId,
      );
      return reply.status(201).send(folder);
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Update folder
  app.put<{
    Params: { folder_id: string };
    Body: { name?: string; parent_id?: string | null };
  }>('/api/folders/:folder_id', { schema: updateFolderSchema }, async (request, reply) => {
    try {
      return await folderService.updateFolder(request.params.folder_id, {
        name: request.body.name,
        parent_id: request.body.parent_id,
      });
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Delete folder
  app.delete<{
    Params: { folder_id: string };
  }>('/api/folders/:folder_id', { schema: deleteFolderSchema }, async (request, reply) => {
    try {
      await folderService.deleteFolder(request.params.folder_id);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Get folder children
  app.get<{
    Params: { folder_id: string };
  }>(
    '/api/folders/:folder_id/children',
    { schema: getFolderChildrenSchema },
    async (request, reply) => {
      try {
        return await folderService.getFolderChildren(request.params.folder_id);
      } catch (error: any) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({ detail: error.message });
        }
        throw error;
      }
    },
  );
}
