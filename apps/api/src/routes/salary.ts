import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const salaryRouter = Router();
salaryRouter.use(authenticate, authorize('ADMIN'));

salaryRouter.post('/calculate/:month', asyncHandler(async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.params.month);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const totalDays = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const guards = await prisma.guard.findMany({ where: { status: 'ACTIVE' }, include: { attendance: { where: { date: { gte: start, lt: end }, status: 'ON_LEAVE' } } } });
  const records = await prisma.$transaction(guards.map((guard) => {
    const gross = Number(guard.monthlySalary);
    const dailyRate = gross / totalDays;
    const leaveDays = guard.attendance.length;
    const deductions = dailyRate * leaveDays;
    return prisma.salaryRecord.upsert({
      where: { guardId_monthYear: { guardId: guard.id, monthYear: start } },
      create: { guardId: guard.id, monthYear: start, totalDays, leaveDays, dailyRate: new Prisma.Decimal(dailyRate.toFixed(2)), grossSalary: guard.monthlySalary, deductions: new Prisma.Decimal(deductions.toFixed(2)), netSalary: new Prisma.Decimal((gross - deductions).toFixed(2)) },
      update: { totalDays, leaveDays, dailyRate: new Prisma.Decimal(dailyRate.toFixed(2)), grossSalary: guard.monthlySalary, deductions: new Prisma.Decimal(deductions.toFixed(2)), netSalary: new Prisma.Decimal((gross - deductions).toFixed(2)), generatedAt: new Date() },
    });
  }));
  await audit(req, 'CALCULATE', 'SalaryRecord', month, { records: records.length });
  res.json({ month, generated: records.length });
}));

salaryRouter.get('/:month', asyncHandler(async (req, res) => {
  const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.params.month);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const data = await prisma.salaryRecord.findMany({ where: { monthYear: start }, include: { guard: { include: { location: true } } }, orderBy: { guard: { name: 'asc' } } });
  const totals = data.reduce((sum, row) => ({ gross: sum.gross + Number(row.grossSalary), deductions: sum.deductions + Number(row.deductions), net: sum.net + Number(row.netSalary) }), { gross: 0, deductions: 0, net: 0 });
  res.json({ data, totals });
}));
