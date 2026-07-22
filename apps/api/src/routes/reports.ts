import { Router } from 'express';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLivePayroll, payrollPeriod } from '../lib/payroll.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize('ADMIN'));

reportsRouter.get('/attendance', asyncHandler(async (req, res) => {
  const { from, to, locationId } = z.object({ from: z.string(), to: z.string(), locationId: z.string().optional() }).parse(req.query);
  const data = await prisma.attendance.findMany({ where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) }, ...(locationId && { guard: { locationId } }) }, include: { guard: { include: { location: true } }, markedBy: { select: { name: true } } }, orderBy: [{ date: 'desc' }, { guard: { name: 'asc' } }] });
  res.json({ data });
}));

reportsRouter.get('/attendance/export', asyncHandler(async (req, res) => {
  const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.query);
  const rows = await prisma.attendance.findMany({ where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } }, include: { guard: { include: { location: true } }, markedBy: true }, orderBy: { date: 'asc' } });
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ Date: row.date.toISOString().slice(0, 10), EmployeeID: row.guard.employeeId, Guard: row.guard.name, Location: row.guard.location.name, Status: row.status, MarkedBy: row.markedBy.name, MarkedAt: row.markedAt.toISOString() })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=attendance-${from}-to-${to}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
}));

reportsRouter.get('/compliance', asyncHandler(async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month);
  const { start } = payrollPeriod(month);
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  const isFutureMonth = start > today;
  const end = monthEnd < today ? monthEnd : today;
  const [managers, attendance] = await Promise.all([
    prisma.user.findMany({ where: { role: 'MANAGER', status: 'ACTIVE' }, include: { locations: { include: { _count: { select: { guards: { where: { status: 'ACTIVE' } } } } } } } }),
    isFutureMonth ? Promise.resolve([]) : prisma.attendance.findMany({ where: { date: { gte: start, lte: end } }, select: { guard: { select: { locationId: true } } } }),
  ]);
  const markedByLocation = new Map<string, number>();
  for (const row of attendance) markedByLocation.set(row.guard.locationId, (markedByLocation.get(row.guard.locationId) ?? 0) + 1);
  const data = managers.map((manager) => {
    const expectedDaily = manager.locations.reduce((sum, location) => sum + location._count.guards, 0);
    const days = isFutureMonth ? 0 : Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const expected = expectedDaily * days;
    const marked = manager.locations.reduce((sum, location) => sum + (markedByLocation.get(location.id) ?? 0), 0);
    return { id: manager.id, name: manager.name, locations: manager.locations.map((l) => l.name), expected, marked, compliance: expected ? Math.min(100, Math.round((marked / expected) * 100)) : 0 };
  });
  res.json({ data });
}));

reportsRouter.get('/summary', asyncHandler(async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.query.month);
  const { start, end } = payrollPeriod(month);
  const [attendance, payroll, activeGuards] = await Promise.all([
    prisma.attendance.groupBy({ by: ['status'], where: { date: { gte: start, lt: end } }, _count: true }),
    getLivePayroll(month),
    prisma.guard.count({ where: { status: 'ACTIVE' } }),
  ]);
  const present = attendance.find((row) => row.status === 'PRESENT')?._count ?? 0;
  const leave = attendance.find((row) => row.status === 'ON_LEAVE')?._count ?? 0;
  res.json({ attendance: { present, leave, marked: present + leave, activeGuards }, payroll: payroll.totals });
}));
