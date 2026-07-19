import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler, AppError, parsePagination } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';

export const managersRouter = Router();
const managerInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().email(),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8).optional(),
  locationIds: z.array(z.string()).min(1),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

managersRouter.use(authenticate, authorize('ADMIN'));
managersRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query);
  const search = String(req.query.search ?? '');
  const where = { role: 'MANAGER' as const, ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] }) };
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true, locations: true }, skip, take: pageSize, orderBy: { name: 'asc' } }),
    prisma.user.count({ where }),
  ]);
  res.json({ data, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}));

managersRouter.post('/', asyncHandler(async (req, res) => {
  const input = managerInput.extend({ password: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.create({ data: {
    name: input.name, email: input.email.toLowerCase(), phone: input.phone, role: 'MANAGER', status: input.status,
    passwordHash: await bcrypt.hash(input.password, 12), locations: { connect: input.locationIds.map((id) => ({ id })) },
  }, include: { locations: true } });
  await audit(req, 'CREATE', 'Manager', user.id);
  res.status(201).json({ data: { ...user, passwordHash: undefined } });
}));

managersRouter.patch('/:id', asyncHandler(async (req, res) => {
  const input = managerInput.partial().parse(req.body);
  const existing = await prisma.user.findFirst({ where: { id: String(req.params.id), role: 'MANAGER' } });
  if (!existing) throw new AppError(404, 'Manager not found');
  const user = await prisma.user.update({ where: { id: existing.id }, data: {
    name: input.name, email: input.email?.toLowerCase(), phone: input.phone, status: input.status,
    ...(input.password && { passwordHash: await bcrypt.hash(input.password, 12) }),
    ...(input.locationIds && { locations: { set: input.locationIds.map((id) => ({ id })) } }),
  }, include: { locations: true } });
  await audit(req, 'UPDATE', 'Manager', user.id, { fields: Object.keys(input).filter((key) => key !== 'password') });
  res.json({ data: { ...user, passwordHash: undefined } });
}));

managersRouter.delete('/:id', asyncHandler(async (req, res) => {
  const user = await prisma.user.update({ where: { id: String(req.params.id) }, data: { status: 'INACTIVE' } });
  await audit(req, 'DEACTIVATE', 'Manager', user.id);
  res.status(204).send();
}));
