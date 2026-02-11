/**
 * Folder module: request/response schemas.
 */

import { FastifySchema } from 'fastify';

export const getFoldersSchema: FastifySchema = {
  description: 'Get folder tree',
  tags: ['folders'],
  querystring: {
    type: 'object',
    properties: {
      parent_id: { type: 'string', nullable: true },
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          parent_id: { type: 'string', nullable: true },
          name: { type: 'string' },
          created_at: { type: 'number' },
          updated_at: { type: 'number' },
        },
      },
    },
  },
};

export const getFolderSchema: FastifySchema = {
  description: 'Get folder by ID',
  tags: ['folders'],
  params: {
    type: 'object',
    properties: {
      folder_id: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        parent_id: { type: 'string', nullable: true },
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
  },
};

export const createFolderSchema: FastifySchema = {
  description: 'Create folder',
  tags: ['folders'],
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      parent_id: { type: 'string', nullable: true },
      name: { type: 'string' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        parent_id: { type: 'string', nullable: true },
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

export const updateFolderSchema: FastifySchema = {
  description: 'Update folder',
  tags: ['folders'],
  params: {
    type: 'object',
    properties: {
      folder_id: { type: 'string' },
    },
  },
  body: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      parent_id: { type: 'string', nullable: true },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        parent_id: { type: 'string', nullable: true },
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

export const deleteFolderSchema: FastifySchema = {
  description: 'Delete folder',
  tags: ['folders'],
  params: {
    type: 'object',
    properties: {
      folder_id: { type: 'string' },
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
    400: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const getFolderChildrenSchema: FastifySchema = {
  description: 'Get folder children (folders and files)',
  tags: ['folders'],
  params: {
    type: 'object',
    properties: {
      folder_id: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        folders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              created_at: { type: 'number' },
              updated_at: { type: 'number' },
            },
          },
        },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              created_at: { type: 'number' },
              updated_at: { type: 'number' },
            },
          },
        },
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
