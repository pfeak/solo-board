/**
 * File module: request/response schemas.
 */

import { FastifySchema } from 'fastify';

export const getFilesSchema: FastifySchema = {
  description: 'Get file list',
  tags: ['files'],
  querystring: {
    type: 'object',
    properties: {
      folder_id: { type: 'string', nullable: true },
      search: { type: 'string' },
      page: { type: 'number', minimum: 1 },
      page_size: { type: 'number', minimum: 1, maximum: 100 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        page: { type: 'number' },
        page_size: { type: 'number' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              folder_id: { type: 'string', nullable: true },
              name: { type: 'string' },
              created_at: { type: 'number' },
              updated_at: { type: 'number' },
            },
          },
        },
      },
    },
  },
};

export const getFileSchema: FastifySchema = {
  description: 'Get file by ID',
  tags: ['files'],
  params: {
    type: 'object',
    properties: {
      file_id: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        folder_id: { type: 'string', nullable: true },
        name: { type: 'string' },
        content: { type: 'string' },
        created_at: { type: 'number' },
        updated_at: { type: 'number' },
      },
    },
    404: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const createFileSchema: FastifySchema = {
  description: 'Create file',
  tags: ['files'],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      folder_id: { type: 'string', nullable: true },
      name: { type: 'string' },
      content: { type: 'string' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        folder_id: { type: 'string', nullable: true },
        name: { type: 'string' },
        created_at: { type: 'number' },
        updated_at: { type: 'number' },
      },
    },
    409: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const updateFileSchema: FastifySchema = {
  description: 'Update file',
  tags: ['files'],
  params: {
    type: 'object',
    properties: {
      file_id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      content: { type: 'string' },
      folder_id: { type: 'string', nullable: true },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        folder_id: { type: 'string', nullable: true },
        name: { type: 'string' },
        created_at: { type: 'number' },
        updated_at: { type: 'number' },
      },
    },
    404: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
    409: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const deleteFileSchema: FastifySchema = {
  description: 'Delete file',
  tags: ['files'],
  params: {
    type: 'object',
    properties: {
      file_id: { type: 'string' },
    },
  },
  response: {
    204: {},
    404: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};
