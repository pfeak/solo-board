/**
 * Authentication module: business logic.
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateUUID } from '../../lib/uuid.js';
import { getCurrentTimestamp } from '../../lib/time.js';
import { UnauthorizedError, BusinessError } from '../../core/errors.js';

const SALT_ROUNDS = 10;

export interface LoginResult {
  id: string;
  username: string;
  is_initial_password: boolean;
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
      throw new UnauthorizedError('用户名或密码错误');
    }

    const isValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    // Update last login time
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: getCurrentTimestamp() },
    });

    return {
      id: admin.id,
      username: admin.username,
      is_initial_password: admin.isInitialPassword,
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
    };
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
      throw new BusinessError('当前密码错误', 400);
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new BusinessError('新密码长度至少 8 位', 400);
    }

    if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      throw new BusinessError('新密码必须包含字母和数字', 400);
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
