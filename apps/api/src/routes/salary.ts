import { Router } from 'express';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { audit } from '../lib/audit.js';
import { asyncHandler } from '../lib/http.js';
import { getLivePayroll, payrollPeriod } from '../lib/payroll.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const salaryRouter = Router();
salaryRouter.use(authenticate, authorize('ADMIN'));

salaryRouter.get('/:month/export', asyncHandler(async (req, res) => {
  const month = String(req.params.month);
  const payroll = await getLivePayroll(month);
  const sheet = XLSX.utils.json_to_sheet(payroll.data.map((row) => ({
    EmployeeID: row.guard.employeeId,
    Guard: row.guard.name,
    Location: row.guard.location.name,
    CalendarDays: row.totalDays,
    LeaveDays: row.leaveDays,
    GuardMonthlySalary: row.guardGrossSalary,
    GuardLeaveDeduction: row.guardDeductions,
    GuardNetPayable: row.guardNetSalary,
    CompanyMonthlyBilling: row.companyGrossSalary,
    CompanyLeaveDeduction: row.companyDeductions,
    CompanyNetBilling: row.companyNetSalary,
    AgencyMargin: row.companyNetSalary - row.guardNetSalary,
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Payroll');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename=payroll-${month}.xlsx`);
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
}));

// Kept for month-end snapshots and auditability. The GET endpoint remains live and never goes stale.
salaryRouter.post('/calculate/:month', asyncHandler(async (req, res) => {
  const month = String(req.params.month);
  const { start } = payrollPeriod(month);
  const payroll = await getLivePayroll(month);
  const records = await prisma.$transaction(payroll.data.map((row) => prisma.salaryRecord.upsert({
    where: { guardId_monthYear: { guardId: row.guard.id, monthYear: start } },
    create: {
      guardId: row.guard.id, monthYear: start, totalDays: row.totalDays, leaveDays: row.leaveDays,
      guardDailyRate: new Prisma.Decimal(row.guardDailyRate), guardGrossSalary: new Prisma.Decimal(row.guardGrossSalary), guardDeductions: new Prisma.Decimal(row.guardDeductions), guardNetSalary: new Prisma.Decimal(row.guardNetSalary),
      companyDailyRate: new Prisma.Decimal(row.companyDailyRate), companyGrossSalary: new Prisma.Decimal(row.companyGrossSalary), companyDeductions: new Prisma.Decimal(row.companyDeductions), companyNetSalary: new Prisma.Decimal(row.companyNetSalary),
    },
    update: {
      totalDays: row.totalDays, leaveDays: row.leaveDays,
      guardDailyRate: new Prisma.Decimal(row.guardDailyRate), guardGrossSalary: new Prisma.Decimal(row.guardGrossSalary), guardDeductions: new Prisma.Decimal(row.guardDeductions), guardNetSalary: new Prisma.Decimal(row.guardNetSalary),
      companyDailyRate: new Prisma.Decimal(row.companyDailyRate), companyGrossSalary: new Prisma.Decimal(row.companyGrossSalary), companyDeductions: new Prisma.Decimal(row.companyDeductions), companyNetSalary: new Prisma.Decimal(row.companyNetSalary), generatedAt: new Date(),
    },
  })));
  await audit(req, 'FINALIZE', 'SalaryRecord', month, { records: records.length });
  res.json({ month, generated: records.length });
}));

salaryRouter.get('/:month', asyncHandler(async (req, res) => {
  res.json(await getLivePayroll(String(req.params.month)));
}));
