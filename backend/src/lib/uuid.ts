/**
 * UUID utility functions.
 *
 * Requirements:
 * - All IDs must be 32-character UUIDs without hyphens
 * - Format: 550e8400e29b41d4a716446655440000
 */

import { randomUUID } from 'crypto';

/**
 * Generate a 32-character UUID without hyphens.
 */
export function generateUUID(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Validate if a string is a valid 32-character UUID (without hyphens).
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{32}$/i.test(id);
}
