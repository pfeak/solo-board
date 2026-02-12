/**
 * Authentication module: HTTP routes.
 */

import { FastifyInstance } from 'fastify';
import prismaPkg from '@prisma/client';
import { AuthService } from './auth.service.js';
import {
  loginSchema,
  logoutSchema,
  meSchema,
  getPreferencesSchema,
  putPreferencesSchema,
  checkInitialPasswordSchema,
  changePasswordSchema,
} from './auth.schema.js';
import {
  createSessionPayload,
  createSessionCookie,
  SESSION_COOKIE_NAME,
} from '../../plugins/session.js';
import { getCurrentTimestamp } from '../../lib/time.js';

const { PrismaClient } = prismaPkg;

export async function registerAuthRoutes(app: FastifyInstance) {
  const prisma = new PrismaClient();
  const authService = new AuthService(prisma);

  // Login (no auth required)
  app.post<{
    Body: { username: string; password: string };
  }>('/api/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { username, password } = request.body;

    try {
      const result = await authService.login(username, password);

      // Create signed session payload cookie
      const payload = createSessionPayload(result.id, result.username);
      reply.setCookie(SESSION_COOKIE_NAME, createSessionCookie(payload), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return result;
    } catch (error: any) {
      if (error.statusCode) {
        return reply.status(error.statusCode).send({ detail: error.message });
      }
      throw error;
    }
  });

  // Logout
  app.post('/api/auth/logout', { schema: logoutSchema }, async (request, reply) => {
    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: '/',
    });

    return { detail: 'Logged out' };
  });

  // Get current user
  app.get('/api/auth/me', { schema: meSchema }, async (request, reply) => {
    const session = (request as any).session;
    if (!session) {
      return reply.status(401).send({ detail: 'Unauthorized' });
    }

    const admin = await authService.getAdminById(session.adminId);
    return admin;
  });

  // Get preferences
  app.get('/api/auth/preferences', { schema: getPreferencesSchema }, async (request, reply) => {
    const session = (request as any).session;
    if (!session) {
      return reply.status(401).send({ detail: 'Unauthorized' });
    }

    const prefs = await authService.getPreferences(session.adminId);
    return prefs ?? {};
  });

  // Put preferences
  app.put<{
    Body: { locale?: 'en' | 'zh' };
  }>('/api/auth/preferences', { schema: putPreferencesSchema }, async (request, reply) => {
    const session = (request as any).session;
    if (!session) {
      return reply.status(401).send({ detail: 'Unauthorized' });
    }

    const updated = await authService.setPreferences(session.adminId, request.body);
    return updated;
  });

  // Check initial password
  app.get(
    '/api/auth/check-initial-password',
    { schema: checkInitialPasswordSchema },
    async (request, reply) => {
      const session = (request as any).session;
      if (!session) {
        return reply.status(401).send({ detail: 'Unauthorized' });
      }

      const isInitial = await authService.checkInitialPassword(session.adminId);
      return { is_initial_password: isInitial };
    },
  );

  // Change password
  app.post<{
    Body: { current_password: string; new_password: string };
  }>(
    '/api/auth/change-password',
    { schema: changePasswordSchema },
    async (request, reply) => {
      const session = (request as any).session;
      if (!session) {
        return reply.status(401).send({ detail: 'Unauthorized' });
      }

      try {
        await authService.changePassword(
          session.adminId,
          request.body.current_password,
          request.body.new_password,
        );

        return { detail: 'Password changed successfully' };
      } catch (error: any) {
        if (error.statusCode) {
          return reply.status(error.statusCode).send({ detail: error.message });
        }
        throw error;
      }
    },
  );
}
