import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();
const resetId = process.env.PRODUCTION_RESET_ID?.trim();

async function main() {
  if (!resetId) {
    process.stdout.write('Production reset not requested.\n');
    return;
  }

  const applied = await prisma.auditLog.findFirst({
    where: { entity: 'ProductionReset', entityId: resetId, action: 'APPLIED' },
    select: { id: true },
  });
  if (applied) {
    process.stdout.write(`Production reset ${resetId} was already applied; skipping.\n`);
    return;
  }

  const input = z.object({
    NODE_ENV: z.literal('production'),
    CONFIRM_PRODUCTION_RESET: z.literal('DELETE_ALL_SHREEDEVI_DATA'),
    PRODUCTION_ADMIN_NAME: z.string().trim().min(2).max(100),
    PRODUCTION_ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
    PRODUCTION_ADMIN_PASSWORD: z.string().min(14).max(128)
      .regex(/[a-z]/, 'Admin password needs a lowercase letter')
      .regex(/[A-Z]/, 'Admin password needs an uppercase letter')
      .regex(/[0-9]/, 'Admin password needs a number')
      .regex(/[^A-Za-z0-9]/, 'Admin password needs a symbol'),
  }).parse(process.env);

  const passwordHash = await bcrypt.hash(input.PRODUCTION_ADMIN_PASSWORD, 12);
  await prisma.$transaction(async (tx) => {
    await tx.payrollPayment.deleteMany();
    await tx.salaryRecord.deleteMany();
    await tx.attendance.deleteMany();
    await tx.guard.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.user.deleteMany();
    await tx.location.deleteMany();

    const admin = await tx.user.create({
      data: {
        name: input.PRODUCTION_ADMIN_NAME,
        email: input.PRODUCTION_ADMIN_EMAIL,
        role: Role.ADMIN,
        status: 'ACTIVE',
        passwordHash,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: admin.id,
        action: 'APPLIED',
        entity: 'ProductionReset',
        entityId: resetId,
        metadata: { administrator: input.PRODUCTION_ADMIN_EMAIL },
      },
    });
  }, { timeout: 30_000 });

  process.stdout.write(`Production reset ${resetId} applied; one administrator created.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`Production reset failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
