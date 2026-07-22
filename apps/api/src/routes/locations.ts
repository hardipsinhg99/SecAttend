import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { AppError, asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const locationsRouter = Router();
const locationInput = z.object({
  name: z.string().trim().min(2).max(100),
  address: z.string().trim().min(3).max(300),
  clientName: z.string().trim().max(150).optional().or(z.literal('')),
});

locationsRouter.use(authenticate);

locationsRouter.get('/', asyncHandler(async (req, res) => {
  const search = String(req.query.search ?? '').trim();
  const includeInactive = req.user!.role === 'ADMIN' && req.query.includeInactive === 'true';
  const locations = await prisma.location.findMany({
    where: {
      ...(!includeInactive && { status: 'ACTIVE' as const }),
      ...(req.user!.role === 'MANAGER' && { managers: { some: { id: req.user!.id } } }),
      ...(search && { OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { address: { contains: search, mode: 'insensitive' as const } },
        { clientName: { contains: search, mode: 'insensitive' as const } },
      ] }),
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { guards: { where: { status: 'ACTIVE' } }, managers: { where: { status: 'ACTIVE' } } } } },
  });
  res.json({ data: locations });
}));

locationsRouter.post('/', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const input = locationInput.parse(req.body);
  const location = await prisma.location.create({ data: { ...input, clientName: input.clientName || null }, include: { _count: { select: { guards: true, managers: true } } } });
  await audit(req, 'CREATE', 'Location', location.id, { name: location.name });
  res.status(201).json({ data: location });
}));

locationsRouter.patch('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const input = locationInput.partial().parse(req.body);
  if (!Object.keys(input).length) throw new AppError(422, 'At least one location field is required');
  const existing = await prisma.location.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, 'Location not found');
  const location = await prisma.location.update({ where: { id: existing.id }, data: { ...input, ...(input.clientName !== undefined && { clientName: input.clientName || null }) }, include: { _count: { select: { guards: { where: { status: 'ACTIVE' } }, managers: { where: { status: 'ACTIVE' } } } } } });
  await audit(req, 'UPDATE', 'Location', location.id, { fields: Object.keys(input) });
  res.json({ data: location });
}));

locationsRouter.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const location = await prisma.location.findUnique({ where: { id }, include: { _count: { select: { guards: { where: { status: 'ACTIVE' } }, managers: { where: { status: 'ACTIVE' } } } } } });
  if (!location) throw new AppError(404, 'Location not found');
  if (location._count.guards || location._count.managers) {
    throw new AppError(409, 'Reassign active guards and managers before deactivating this location', location._count);
  }
  await prisma.location.update({ where: { id }, data: { status: 'INACTIVE' } });
  await audit(req, 'DEACTIVATE', 'Location', id, { name: location.name });
  res.status(204).send();
}));

locationsRouter.post('/:id/activate', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Location not found');
  const location = await prisma.location.update({ where: { id }, data: { status: 'ACTIVE' }, include: { _count: { select: { guards: true, managers: true } } } });
  await audit(req, 'ACTIVATE', 'Location', id, { name: location.name });
  res.json({ data: location });
}));
