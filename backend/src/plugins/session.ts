/**
 * Session management plugin for Fastify.
 *
 * Responsibilities:
 * - Store session data in memory (or Redis in production)
 * - Validate session cookies
 * - Provide session middleware
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';

interface SessionData {
  adminId: string;
  username: string;
  createdAt: number;
}

/**
 * We store the session payload inside a signed cookie.
 *
 * Why:
 * - The previous in-memory Map store would be wiped on backend restart / hot reload,
 *   causing "cookie exists but /me returns 401" and the frontend redirects back to /login.
 * - Signed cookies keep dev simple while preserving integrity.
 *
 * Note:
 * - This is not encrypted (payload is visible to client).
 * - For production, consider server-side storage (Redis/DB) if you need revocation.
 */
export const SESSION_COOKIE_NAME = 'session';

export function createSessionPayload(adminId: string, username: string): SessionData {
  return {
    adminId,
    username,
    createdAt: Math.floor(Date.now() / 1000),
  };
}

function decodeBase64Url(input: string): string | null {
  try {
    // Node 18+ supports base64url
    return Buffer.from(input, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function encodeSessionCookieValue(payload: SessionData): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function parseSessionPayload(rawBase64Url: string): SessionData | null {
  try {
    const json = decodeBase64Url(rawBase64Url);
    if (!json) return null;
    const parsed = JSON.parse(json) as Partial<SessionData>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.adminId !== 'string' ||
      typeof parsed.username !== 'string' ||
      typeof parsed.createdAt !== 'number'
    ) {
      return null;
    }
    return {
      adminId: parsed.adminId,
      username: parsed.username,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

function getSessionSecret(): string {
  // Must match backend config default.
  return process.env.SESSION_SECRET || 'change-me-in-production';
}

function signBase64Url(payloadB64: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
}

/**
 * Create a cookie value safe for transport (base64url only).
 * Format: <payloadBase64Url>.<sigBase64Url>
 */
export function createSessionCookie(payload: SessionData): string {
  const payloadB64 = encodeSessionCookieValue(payload);
  const sig = signBase64Url(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifySessionCookie(cookieValue: string): SessionData | null {
  const idx = cookieValue.lastIndexOf('.');
  if (idx <= 0) return null;
  const payloadB64 = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);

  const expected = signBase64Url(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return parseSessionPayload(payloadB64);
}

export async function sessionPlugin(fastify: FastifyInstance) {
  // Session middleware: validate session cookie
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth check for login endpoint
    if (request.url.startsWith('/api/auth/login')) {
      return;
    }

    // Allow logout to be idempotent even without a session
    if (request.url.startsWith('/api/auth/logout')) {
      return;
    }

    // Dev debug endpoint should be accessible without auth
    if (request.url.startsWith('/api/_debug/')) {
      return;
    }

    // Skip health check and root
    if (request.url === '/health' || request.url === '/') {
      return;
    }

    const cookieValue = (request.cookies as any)[SESSION_COOKIE_NAME] as string | undefined;
    if (!cookieValue) {
      return reply.status(401).send({ detail: 'Unauthorized' });
    }

    const session = verifySessionCookie(cookieValue);
    if (!session) {
      return reply.status(401).send({ detail: 'Unauthorized' });
    }

    // Attach session to request
    (request as any).session = session;
  });
}
