/**
 * Time utility functions.
 *
 * Requirements:
 * - All timestamps are UTC Unix timestamps (seconds)
 */

/**
 * Get current UTC timestamp in seconds.
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
