/**
 * File module: HTTP routes.
 */

import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { FileService } from './file.service.js';
import {
  getFilesSchema,
  getFileSchema,
  createFileSchema,
  updateFileSchema,
  deleteFileSchema,
} from './file.schema.js';

export async function registerFileRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const fileService = new FileService(prisma);

  // Get file list
  app.get<{
    Querystring: {
      folder_id?: string | null;
      search?: string;
      page?: number;
      page_size?: number;
    };
  }>('/api/files', { schema: getFilesSchema }, async (request) => {
    const folderId = request.query.folder_id || null;
    const search = request.query.search;
    const page = request.query.page || 1;
    const pageSize = Math.min(request.query.page_size || 20, 100);

    return fileService.getFiles(folderId, search, page, pageSize);
  });

  // Get file by ID
  app.get<{
    Params: { file_id: string };
  }>('/api/files/:file_id', { schema: getFileSchema }, async (request, reply) => {
    try {
      return await fileService.getFileById(request.params.file_id);
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Create file
  app.post<{
    Body: { folder_id?: string | null; name: string; content?: string };
  }>('/api/files', { schema: createFileSchema }, async (request, reply) => {
    const session = (request as any).session;
    try {
      const file = await fileService.createFile(
        request.body.folder_id || null,
        request.body.name,
        request.body.content || '{}',
        session?.adminId,
      );
      return reply.status(201).send(file);
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Update file
  app.put<{
    Params: { file_id: string };
    Body: { name?: string; content?: string; folder_id?: string | null };
  }>('/api/files/:file_id', { schema: updateFileSchema }, async (request, reply) => {
    try {
      return await fileService.updateFile(request.params.file_id, {
        name: request.body.name,
        content: request.body.content,
        folder_id: request.body.folder_id,
      });
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Delete file
  app.delete<{
    Params: { file_id: string };
  }>('/api/files/:file_id', { schema: deleteFileSchema }, async (request, reply) => {
    try {
      await fileService.deleteFile(request.params.file_id);
      return reply.status(204).send();
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });
}
