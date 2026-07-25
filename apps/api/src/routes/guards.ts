import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { asyncHandler, AppError, parsePagination } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';
import { randomUUID } from 'node:crypto';
import { extractGuardImportRows } from '../lib/guard-import.js';

export const guardsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const guardInput = z.object({
  name: z.string().trim().min(2).max(100),
  employeeId: z.string().trim().max(30).optional().or(z.literal('')),
  phone: z.string().trim().min(7).max(20).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
  locationId: z.string().min(1),
  photoUrl: z.string().url().optional().or(z.literal('')),
  joiningDate: z.preprocess((value) => value === '' ? undefined : value, z.coerce.date().optional()),
  project: z.string().trim().max(100).optional().or(z.literal('')),
  village: z.string().trim().max(100).optional().or(z.literal('')),
  shiftType: z.preprocess((value) => value === '' ? undefined : value, z.enum(['DAY', 'NIGHT', 'ROTATING']).optional()),
  postDetail: z.string().trim().max(150).optional().or(z.literal('')),
  designation: z.enum(['SECURITY_GUARD', 'SUPERVISOR']).default('SECURITY_GUARD'),
  guardMonthlySalary: z.coerce.number().positive().max(10_000_000),
  companyMonthlySalary: z.coerce.number().positive().max(10_000_000),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

function employeeIdentity(value?: string) {
  const provisional = !value || value.trim().toUpperCase() === 'NEW';
  return { employeeId: provisional ? `NEW-${randomUUID().slice(0, 8).toUpperCase()}` : value!.trim(), provisionalEmployeeId: provisional };
}

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

guardsRouter.post('/', authorize('ADMIN', 'MANAGER'), asyncHandler(async (req, res) => {
  const input = guardInput.parse(req.body);
  const locationExists = await prisma.location.count({ where: { id: input.locationId, status: 'ACTIVE' } });
  if (!locationExists) throw new AppError(422, 'Select an active location');
  const guard = await prisma.guard.create({ data: { ...input, ...employeeIdentity(input.employeeId), phone: input.phone || null, address: input.address || null, email: input.email || null, photoUrl: input.photoUrl || null, project: input.project || null, village: input.village || null, postDetail: input.postDetail || null }, include: { location: true } });
  await audit(req, 'CREATE', 'Guard', guard.id, { employeeId: guard.employeeId });
  res.status(201).json({ data: guard });
}));

guardsRouter.patch('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
  const input = guardInput.partial().parse(req.body);
  if (input.locationId) {
    const locationExists = await prisma.location.count({ where: { id: input.locationId, status: 'ACTIVE' } });
    if (!locationExists) throw new AppError(422, 'Select an active location');
  }
  const guard = await prisma.guard.update({ where: { id: String(req.params.id) }, data: { ...input, ...(input.employeeId !== undefined && employeeIdentity(input.employeeId)), phone: input.phone === '' ? null : input.phone, address: input.address === '' ? null : input.address, email: input.email === '' ? null : input.email, photoUrl: input.photoUrl === '' ? null : input.photoUrl, project: input.project === '' ? null : input.project, village: input.village === '' ? null : input.village, postDetail: input.postDetail === '' ? null : input.postDetail }, include: { location: true } });
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
  const rows = extractGuardImportRows(sheet);
  if (!rows.length) throw new AppError(422, 'No guard rows were found. Use the roster template or a supported attendance register.');
  if (rows.length > 1000) throw new AppError(422, 'Import is limited to 1,000 rows at a time');
  const locations = await prisma.location.findMany({ where: { status: 'ACTIVE' } });
  const locationKey = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const byName = new Map(locations.map((location) => [locationKey(location.name), location.id]));
  const errors: { row: number; message: string }[] = [];
  let imported = 0;
  for (const row of rows) {
    const locationId = byName.get(locationKey(row.location));
    if (!locationId) { errors.push({ row: row.rowNumber, message: `Active location "${row.location || 'blank'}" was not found. Add it in Locations first.` }); continue; }
    const parsed = guardInput.safeParse({
      name: row.name, employeeId: row.employeeId, phone: row.phone, email: row.email,
      address: row.address, locationId,
      joiningDate: row.joiningDate,
      project: row.project,
      village: row.village,
      shiftType: row.shiftType || undefined,
      postDetail: row.postDetail,
      designation: row.designation,
      guardMonthlySalary: row.guardMonthlySalary,
      companyMonthlySalary: row.companyMonthlySalary,
    });
    if (!parsed.success) { errors.push({ row: row.rowNumber, message: parsed.error.issues[0]?.message ?? 'Invalid row' }); continue; }
    try {
      await prisma.guard.create({ data: { ...parsed.data, ...employeeIdentity(parsed.data.employeeId), phone: parsed.data.phone || null, address: parsed.data.address || null, email: parsed.data.email || null, project: parsed.data.project || null, village: parsed.data.village || null, postDetail: parsed.data.postDetail || null } });
      imported += 1;
    } catch { errors.push({ row: row.rowNumber, message: 'Employee ID or email already exists' }); }
  }
  await audit(req, 'IMPORT', 'Guard', undefined, { imported, rejected: errors.length });
  res.json({ imported, rejected: errors.length, errors });
}));
