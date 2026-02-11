/**
 * Prisma seed script: create initial admin user.
 *
 * Default credentials:
 * - Username: admin
 * - Password: 123456
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateUUID } from '../src/lib/uuid.js';
import { getCurrentTimestamp } from '../src/lib/time.js';

const SALT_ROUNDS = 10;

async function main() {
  const prisma = new PrismaClient();

  try {
    // Check if admin already exists
    const existing = await prisma.admin.findUnique({
      where: { username: 'admin' },
    });

    if (existing) {
      console.log('Admin user already exists, skipping seed.');
      return;
    }

    // Create default admin
    const passwordHash = await bcrypt.hash('123456', SALT_ROUNDS);
    const now = getCurrentTimestamp();

    const admin = await prisma.admin.create({
      data: {
        id: generateUUID(),
        username: 'admin',
        passwordHash,
        createdAt: now,
        isInitialPassword: true,
      },
    });

    console.log('Created default admin user:', admin.id);
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
