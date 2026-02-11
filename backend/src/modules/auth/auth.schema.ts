/**
 * Authentication module: request/response schemas.
 */

import { FastifySchema } from 'fastify';

export const loginSchema: FastifySchema = {
  description: 'Admin login',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['username', 'password'],
    properties: {
      username: { type: 'string' },
      password: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        is_initial_password: { type: 'boolean' },
      },
    },
    401: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const logoutSchema: FastifySchema = {
  description: 'Admin logout',
  tags: ['auth'],
  response: {
    200: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const meSchema: FastifySchema = {
  description: 'Get current user',
  tags: ['auth'],
  response: {
    200: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        created_at: { type: 'number' },
        last_login_at: { type: 'number', nullable: true },
        is_initial_password: { type: 'boolean' },
      },
    },
    401: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const checkInitialPasswordSchema: FastifySchema = {
  description: 'Check if using initial password',
  tags: ['auth'],
  response: {
    200: {
      type: 'object',
      properties: {
        is_initial_password: { type: 'boolean' },
      },
    },
    401: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};

export const changePasswordSchema: FastifySchema = {
  description: 'Change password',
  tags: ['auth'],
  body: {
    type: 'object',
    required: ['current_password', 'new_password'],
    properties: {
      current_password: { type: 'string' },
      new_password: { type: 'string' },
    },
  },
  response: {
    200: {
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
    401: {
      type: 'object',
      properties: {
        detail: { type: 'string' },
      },
    },
  },
};
