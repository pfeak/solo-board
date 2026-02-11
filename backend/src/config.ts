/**
 * Application configuration loader.
 *
 * Responsibilities:
 * - Load configuration from environment variables / .env file
 * - Expose a typed configuration object for other backend modules
 */

import dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  APP_NAME: string;
  APP_VERSION: string;
  PORT: number;
  DATABASE_URL: string;
  LOG_LEVEL: string;
  CORS_ORIGINS: string[];
  SESSION_SECRET: string;
  SESSION_TTL: number;
}

export function loadConfig(): AppConfig {
  const {
    APP_NAME = 'solo-board-backend',
    APP_VERSION = '0.1.0',
    PORT = '8000',
    DATABASE_URL = 'file:./dev.db',
    LOG_LEVEL = 'info',
    CORS_ORIGINS = '',
    SESSION_SECRET = 'change-me-in-production',
    SESSION_TTL = '604800', // 7 days in seconds
  } = process.env;

  const origins =
    CORS_ORIGINS.trim().length === 0
      ? []
      : CORS_ORIGINS.split(',').map((x) => x.trim()).filter(Boolean);

  return {
    APP_NAME,
    APP_VERSION,
    PORT: Number(PORT),
    DATABASE_URL,
    LOG_LEVEL,
    CORS_ORIGINS: origins,
    SESSION_SECRET,
    SESSION_TTL: Number(SESSION_TTL),
  };
}

