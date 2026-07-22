import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { AppError, asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { businessDateKey } from '../lib/business-date.js';

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(422, 'Date must use YYYY-MM-DD format');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new AppError(422, 'Date must be a valid calendar date');
  return parsed;
}

attendanceRouter.get('/calendar/summary', asyncHandler(async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const guardWhere = req.user!.role === 'MANAGER' ? { location: { managers: { some: { id: req.user!.id } } }, status: 'ACTIVE' as const } : { status: 'ACTIVE' as const };
  const [guards, rows] = await Promise.all([
    prisma.guard.findMany({ where: guardWhere, select: { joiningDate: true } }),
    prisma.attendance.groupBy({ by: ['date', 'status'], where: { date: { gte: start, lt: end }, guard: guardWhere }, _count: true }),
  ]);
  const summary = new Map<string, { date: string; marked: number; present: number; absent: number; total: number; state: string }>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const total = guards.filter((guard) => !guard.joiningDate || guard.joiningDate <= row.date).length;
    const item = summary.get(key) ?? { date: key, marked: 0, present: 0, absent: 0, total, state: 'none' };
    item.marked += row._count;
    if (row.status === 'PRESENT') item.present += row._count;
    else item.absent += row._count;
    item.state = item.marked >= total ? 'complete' : 'partial';
    summary.set(key, item);
  }
  res.json({ data: [...summary.values()], totalGuards: guards.length });
}));

attendanceRouter.get('/:date', asyncHandler(async (req, res) => {
  const dateKey = String(req.params.date);
  const date = day(dateKey);
  const eligibility = { OR: [{ joiningDate: null }, { joiningDate: { lte: date } }] };
  const where = req.user!.role === 'MANAGER' ? { status: 'ACTIVE' as const, ...eligibility, location: { managers: { some: { id: req.user!.id } } } } : { status: 'ACTIVE' as const, ...eligibility };
  const guards = await prisma.guard.findMany({ where, include: { location: true, attendance: { where: { date }, select: { id: true, status: true, markedAt: true, updatedAt: true } } }, orderBy: { name: 'asc' } });
  res.json({ data: guards.map(({ attendance, ...guard }) => ({ ...guard, attendance: attendance[0] ?? null })), editable: dateKey <= businessDateKey() });
}));

attendanceRouter.post('/:date', asyncHandler(async (req, res) => {
  const dateKey = String(req.params.date);
  const date = day(dateKey);
  if (dateKey > businessDateKey()) throw new AppError(422, 'Future attendance cannot be marked');
  const input = z.object({ records: z.array(z.object({ guardId: z.string(), status: z.enum(['PRESENT', 'ABSENT']) })).min(1).max(500) }).parse(req.body);
  const uniqueIds = [...new Set(input.records.map((record) => record.guardId))];
  if (uniqueIds.length !== input.records.length) throw new AppError(422, 'Duplicate guard records are not allowed');
  const allowedCount = await prisma.guard.count({ where: { id: { in: uniqueIds }, status: 'ACTIVE', OR: [{ joiningDate: null }, { joiningDate: { lte: date } }], ...(req.user!.role === 'MANAGER' && { location: { managers: { some: { id: req.user!.id } } } }) } });
  if (allowedCount !== uniqueIds.length) throw new AppError(403, 'One or more guards are outside your assigned locations');
  await prisma.$transaction(input.records.map((record) => prisma.attendance.upsert({
    where: { guardId_date: { guardId: record.guardId, date } },
    create: { guardId: record.guardId, date, status: record.status, markedById: req.user!.id },
    update: { status: record.status, markedById: req.user!.id, markedAt: new Date() },
  })));
  await audit(req, 'MARK_ATTENDANCE', 'Attendance', String(req.params.date), { records: input.records.length });
  res.json({ saved: input.records.length, markedAt: new Date().toISOString() });
}));
