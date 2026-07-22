import { Router } from 'express';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { getLivePayroll, payrollPeriod } from '../lib/payroll.js';
import { AppError } from '../lib/http.js';

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
  const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({ Date: row.date.toISOString().slice(0, 10), EmployeeID: row.guard.employeeId, Guard: row.guard.name, DateOfJoining: row.guard.joiningDate?.toISOString().slice(0, 10) ?? '', Project: row.guard.project ?? '', Village: row.guard.village ?? '', Shift: row.guard.shiftType ?? '', Location: row.guard.location.name, PostDetail: row.guard.postDetail ?? '', Status: row.status, MarkedBy: row.markedBy.name, MarkedAt: row.markedAt.toISOString() })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=attendance-${from}-to-${to}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
}));

reportsRouter.get('/site-attendance/export', asyncHandler(async (req, res) => {
  const { month, locationId } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), locationId: z.string().min(1) }).parse(req.query);
  const { start, end, totalDays } = payrollPeriod(month);
  const [location, guards, payroll] = await Promise.all([
    prisma.location.findUnique({ where: { id: locationId } }),
    prisma.guard.findMany({ where: { locationId, status: 'ACTIVE' }, include: { attendance: { where: { date: { gte: start, lt: end } } } }, orderBy: { name: 'asc' } }),
    getLivePayroll(month),
  ]);
  if (!location) throw new AppError(404, 'Location not found');
  const payrollByGuard = new Map(payroll.data.map((row) => [row.guard.id, row]));
  const dayHeaders = Array.from({ length: totalDays }, (_, index) => index + 1);
  const rows: (string | number)[][] = [
    ['ATTENDANCE REGISTER'],
    [`SITE: ${location.name}`, location.address ?? ''],
    [`PRINCIPAL EMPLOYER / CLIENT: ${location.clientName ?? 'Not specified'}`],
    ['Sr. No', 'EMP CODE', 'FULL NAME', 'DATE OF JOINING', 'MOBILE NO.', 'GUARD FIXED SALARY', 'COMPANY BILLING', 'PROJECT', 'VILLAGE', 'SHIFT', 'POST / LOCATION DETAIL', ...dayHeaders, 'ABSENT', 'PRESENT DAYS', 'GUARD PAYABLE', 'COMPANY PAYABLE'],
  ];
  guards.forEach((guard, index) => {
    const attendance = new Map(guard.attendance.map((record) => [record.date.toISOString().slice(0, 10), record.status]));
    const codes = dayHeaders.map((day) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
      if (guard.joiningDate && date < guard.joiningDate) return '';
      const status = attendance.get(date.toISOString().slice(0, 10));
      return status === 'PRESENT' ? 'P' : status === 'ABSENT' ? 'A' : '';
    });
    const salary = payrollByGuard.get(guard.id);
    rows.push([index + 1, guard.provisionalEmployeeId ? 'NEW' : guard.employeeId, guard.name, guard.joiningDate?.toISOString().slice(0, 10) ?? '', guard.phone ?? '', Number(guard.guardMonthlySalary), Number(guard.companyMonthlySalary), guard.project ?? '', guard.village ?? '', guard.shiftType ?? '', guard.postDetail ?? '', ...codes, salary?.absentDays ?? 0, salary?.presentDays ?? 0, salary?.guardNetSalary ?? 0, salary?.companyNetSalary ?? 0]);
  });
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 14 + totalDays } }];
  sheet['!cols'] = [{ wch: 7 }, { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 24 }, ...dayHeaders.map(() => ({ wch: 4 })), { wch: 9 }, { wch: 13 }, { wch: 16 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, month.toUpperCase());
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=site-attendance-${month}.xlsx`);
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
    prisma.user.findMany({ where: { role: 'MANAGER', status: 'ACTIVE' }, include: { locations: { include: { guards: { where: { status: 'ACTIVE' }, select: { joiningDate: true } } } } } }),
    isFutureMonth ? Promise.resolve([]) : prisma.attendance.findMany({ where: { date: { gte: start, lte: end } }, select: { guard: { select: { locationId: true } } } }),
  ]);
  const markedByLocation = new Map<string, number>();
  for (const row of attendance) markedByLocation.set(row.guard.locationId, (markedByLocation.get(row.guard.locationId) ?? 0) + 1);
  const data = managers.map((manager) => {
    const expected = isFutureMonth ? 0 : manager.locations.reduce((locationSum, location) => locationSum + location.guards.reduce((guardSum, guard) => {
      const eligibleStart = guard.joiningDate && guard.joiningDate > start ? guard.joiningDate : start;
      return guardSum + Math.max(0, Math.floor((end.getTime() - eligibleStart.getTime()) / 86_400_000) + 1);
    }, 0), 0);
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
  const absent = attendance.find((row) => row.status === 'ABSENT')?._count ?? 0;
  res.json({ attendance: { present, absent, marked: present + absent, activeGuards }, payroll: payroll.totals });
}));
