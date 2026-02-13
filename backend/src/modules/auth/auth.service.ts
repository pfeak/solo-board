/**
 * Authentication module: business logic.
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateUUID } from '../../lib/uuid.js';
import { getCurrentTimestamp } from '../../lib/time.js';
import { UnauthorizedError, BusinessError } from '../../core/errors.js';

const SALT_ROUNDS = 10;

export interface AdminPreferences {
  locale?: 'en' | 'zh';
}

export interface LoginResult {
  id: string;
  username: string;
  is_initial_password: boolean;
  preferences?: AdminPreferences | null;
}

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Authenticate admin and return user info.
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      throw new UnauthorizedError('Invalid username or password');
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Update last login time and return admin with preferences
    const updated = await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: getCurrentTimestamp() },
    });

    return {
      id: updated.id,
      username: updated.username,
      is_initial_password: updated.isInitialPassword,
      preferences: (updated.preferences as AdminPreferences | null) ?? null,
    };
  }

  /**
   * Get admin by ID.
   */
  async getAdminById(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedError('User not found');
    }

    return {
      id: admin.id,
      username: admin.username,
      created_at: admin.createdAt,
      last_login_at: admin.lastLoginAt,
      is_initial_password: admin.isInitialPassword,
      preferences: (admin.preferences as AdminPreferences | null) ?? null,
    };
  }

  /**
   * Get admin preferences.
   */
  async getPreferences(adminId: string): Promise<AdminPreferences | null> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { preferences: true },
    });
    if (!admin || admin.preferences == null) return null;
    return admin.preferences as AdminPreferences;
  }

  /**
   * Update admin preferences (merge with existing).
   */
  async setPreferences(adminId: string, prefs: Partial<AdminPreferences>): Promise<AdminPreferences> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { preferences: true },
    });
    if (!admin) {
      throw new UnauthorizedError('User not found');
    }
    const current = (admin.preferences as AdminPreferences | null) ?? {};
    const merged = { ...current, ...prefs };
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { preferences: merged as object },
    });
    return merged;
  }

  /**
   * Check if admin is using initial password.
   */
  async checkInitialPassword(adminId: string): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedError('User not found');
    }

    return admin.isInitialPassword;
  }

  /**
   * Change password.
   */
  async changePassword(
    adminId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedError('User not found');
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isValid) {
      throw new BusinessError('Current password is incorrect', 400);
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new BusinessError('New password must be at least 8 characters', 400);
    }

    if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      throw new BusinessError('New password must contain letters and numbers', 400);
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and clear initial password flag
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash: newPasswordHash,
        isInitialPassword: false,
      },
    });
  }
}
