/**
 * Solo-Board backend entrypoint.
 *
 * Responsibilities:
 * - Create the Fastify instance
 * - Register global plugins (CORS, cookie, Swagger, etc.)
 * - Register business module routes (auth/folder/file)
 * - Start the HTTP server and listen on the configured port
 */

import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

import { loadConfig } from './config.js';
import { sessionPlugin } from './plugins/session.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerFolderRoutes } from './modules/folder/folder.routes.js';
import { registerFileRoutes } from './modules/file/file.routes.js';
import { generateUUID } from './lib/uuid.js';
import { getCurrentTimestamp } from './lib/time.js';
import { verifySessionCookie, SESSION_COOKIE_NAME } from './plugins/session.js';

async function bootstrap() {
  const config = loadConfig();

  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  // Single shared PrismaClient for the whole app (ensures same DB as default-admin creation).
  const prisma = new PrismaClient();
  try {
    app.log.info(`Database URL: ${config.DATABASE_URL}`);
    await prisma.$connect();
    app.log.info('Database connection established');

    const adminCount = await prisma.admin.count();
    app.log.info(`Current admin count: ${adminCount}`);

    if (adminCount === 0) {
      const defaultUsername = config.DEFAULT_ADMIN_USERNAME;
      const defaultPassword = config.DEFAULT_ADMIN_PASSWORD;
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      const admin = await prisma.admin.create({
        data: {
          id: generateUUID(),
          username: defaultUsername,
          passwordHash,
          createdAt: getCurrentTimestamp(),
          isInitialPassword: true,
        },
      });
      app.log.info(`Created default admin user: ${defaultUsername} / ${defaultPassword} (ID: ${admin.id})`);
    } else {
      app.log.info('Admin users already exist, skipping default admin creation');
    }
  } catch (err) {
    app.log.error({ err, databaseUrl: config.DATABASE_URL }, 'Failed to ensure default admin user');
  }
  // Do NOT disconnect – routes use the same prisma instance

  // CORS configuration allowing frontend to send cookies
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.CORS_ORIGINS.length === 0) return cb(null, true);
      if (config.CORS_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error('CORS origin not allowed'), false);
    },
    credentials: true,
  });

  // Cookie support (for session handling)
  await app.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  // Session management (global hook; do NOT use register() due to encapsulation)
  await sessionPlugin(app);

  // Dev-only debug helper to inspect session cookie parsing/verification.
  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/_debug/session', async (request) => {
      const raw = (request.cookies as any)[SESSION_COOKIE_NAME] as string | undefined;
      const parsed = raw ? verifySessionCookie(raw) : null;
      return {
        has_cookie: Boolean(raw),
        cookie_name: SESSION_COOKIE_NAME,
        cookie_value_preview: raw ? `${raw.slice(0, 16)}...${raw.slice(-16)}` : null,
        verified: Boolean(parsed),
        session: parsed,
        // help detect "different secrets across processes"
        session_secret_set: Boolean(process.env.SESSION_SECRET),
      };
    });
  }

  // Optional Swagger/OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Solo-Board API',
        version: config.APP_VERSION,
      },
    },
  });
  await app.register(swaggerUI, {
    routePrefix: '/docs',
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      app: config.APP_NAME,
      version: config.APP_VERSION,
    };
  });

  // Root path hint
  app.get('/', async () => {
    return { detail: 'Solo-Board backend API. See /docs for OpenAPI spec.' };
  });

  // Register business routes (share same prisma instance)
  await registerAuthRoutes(app, prisma);
  await registerFolderRoutes(app, prisma);
  await registerFileRoutes(app, prisma);

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Solo-Board backend listening on port ${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();

