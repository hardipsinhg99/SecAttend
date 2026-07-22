import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

async function main() {
  const input = z.object({
    ADMIN_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
    ADMIN_PASSWORD: z.string().min(14).max(128),
  }).parse(process.env);
  const passwordHash = await bcrypt.hash(input.ADMIN_PASSWORD, 12);
  await prisma.user.upsert({
    where: { email: input.ADMIN_EMAIL },
    update: { name: 'Admin', role: Role.ADMIN, status: 'ACTIVE', passwordHash },
    create: { name: 'Admin', email: input.ADMIN_EMAIL, role: Role.ADMIN, status: 'ACTIVE', passwordHash },
  });
  process.stdout.write(`Administrator ${input.ADMIN_EMAIL} is ready.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
