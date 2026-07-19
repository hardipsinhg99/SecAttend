import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const locationsRouter = Router();
locationsRouter.use(authenticate);
locationsRouter.get('/', asyncHandler(async (_req, res) => {
  const locations = await prisma.location.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { guards: true, managers: true } } } });
  res.json({ data: locations });
}));
