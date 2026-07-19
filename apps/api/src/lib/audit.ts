import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export async function audit(req: Request, action: string, entity: string, entityId?: string, metadata?: Prisma.InputJsonValue) {
  await prisma.auditLog.create({ data: {
    actorId: req.user?.id,
    action,
    entity,
    entityId,
    metadata,
    ipAddress: req.ip,
  }});
}
