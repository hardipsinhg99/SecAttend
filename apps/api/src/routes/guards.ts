import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { asyncHandler, AppError, parsePagination } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';

export const guardsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const guardInput = z.object({
  name: z.string().trim().min(2).max(100),
  employeeId: z.string().trim().min(2).max(30),
  phone: z.string().trim().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().trim().min(3).max(300),
  locationId: z.string().min(1),
  photoUrl: z.string().url().optional().or(z.literal('')),
  monthlySalary: z.coerce.number().positive().max(10_000_000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

guardsRouter.use(authenticate);

guardsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query);
  const search = String(req.query.search ?? '').trim();
  const status = req.query.status === 'INACTIVE' ? 'INACTIVE' : req.query.status === 'ACTIVE' ? 'ACTIVE' : undefined;
  const locationId = String(req.query.locationId ?? '');
  const managerScope = req.user!.role === 'MANAGER' ? { location: { managers: { some: { id: req.user!.id } } } } : {};
  const where: Prisma.GuardWhereInput = {
    ...managerScope,
    ...(status && { status }),
    ...(locationId && { locationId }),
    ...(search && { OR: [
      { name: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ] }),
  };
  const [data, total] = await Promise.all([
    prisma.guard.findMany({ where, include: { location: true }, skip, take: pageSize, orderBy: { name: 'asc' } }),
    prisma.guard.count({ where }),
  ]);
  res.json({ data, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
}));

guardsRouter.get('/:id', asyncHandler(async (req, res) => {
  const guard = await prisma.guard.findUnique({ where: { id: String(req.params.id) }, include: { location: true, attendance: { take: 31, orderBy: { date: 'desc' } } } });
  if (!guard) throw new AppError(404, 'Guard not found');
  if (req.user!.role === 'MANAGER') {
    const allowed = await prisma.location.count({ where: { id: guard.locationId, managers: { some: { id: req.user!.id } } } });
    if (!allowed) throw new AppError(403, 'This guard is outside your assigned locations');
  }
  res.json({ data: guard });
}));

guardsRouter.post('/', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const input = guardInput.parse(req.body);
  const guard = await prisma.guard.create({ data: { ...input, email: input.email || null, photoUrl: input.photoUrl || null }, include: { location: true } });
  await audit(req, 'CREATE', 'Guard', guard.id, { employeeId: guard.employeeId });
  res.status(201).json({ data: guard });
}));

guardsRouter.patch('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const input = guardInput.partial().parse(req.body);
  const guard = await prisma.guard.update({ where: { id: String(req.params.id) }, data: { ...input, email: input.email || undefined, photoUrl: input.photoUrl || undefined }, include: { location: true } });
  await audit(req, 'UPDATE', 'Guard', guard.id, { fields: Object.keys(input) });
  res.json({ data: guard });
}));

guardsRouter.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const guard = await prisma.guard.update({ where: { id: String(req.params.id) }, data: { status: 'INACTIVE' } });
  await audit(req, 'DEACTIVATE', 'Guard', guard.id);
  res.status(204).send();
}));

guardsRouter.post('/import/excel', authorize('ADMIN'), upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, 'An Excel file is required');
  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!sheet) throw new AppError(422, 'The workbook has no readable worksheet');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  if (rows.length > 1000) throw new AppError(422, 'Import is limited to 1,000 rows at a time');
  const locations = await prisma.location.findMany();
  const byName = new Map(locations.map((location) => [location.name.toLowerCase(), location.id]));
  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  for (const [index, row] of rows.entries()) {
    const locationId = byName.get(String(row.Location).trim().toLowerCase());
    const parsed = guardInput.safeParse({
      name: row.Name, employeeId: row.EmployeeID, phone: String(row.Phone), email: row.Email,
      address: row.Address, locationId, monthlySalary: row.MonthlySalary,
    });
    if (!parsed.success) { errors.push({ row: index + 2, message: parsed.error.issues[0]?.message ?? 'Invalid row' }); continue; }
    try {
      await prisma.guard.create({ data: { ...parsed.data, email: parsed.data.email || null } });
      imported += 1;
    } catch { errors.push({ row: index + 2, message: 'Employee ID or email already exists' }); }
  }
  await audit(req, 'IMPORT', 'Guard', undefined, { imported, rejected: errors.length });
  res.json({ imported, rejected: errors.length, errors });
}));
