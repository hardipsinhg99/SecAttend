import { Router } from 'express';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { audit } from '../lib/audit.js';
import { asyncHandler } from '../lib/http.js';
import { getLivePayroll, payrollPeriod, persistPayrollForMonth } from '../lib/payroll.js';
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
    Project: row.guard.project ?? '',
    Village: row.guard.village ?? '',
    Shift: row.guard.shiftType ?? '',
    PostDetail: row.guard.postDetail ?? '',
    CalendarDays: row.totalDays,
    EligibleDays: row.eligibleDays,
    PresentDays: row.presentDays,
    AbsentDays: row.absentDays,
    PaymentStatus: row.paymentStatus,
    PaidAt: row.paidAt?.toISOString() ?? '',
    PaymentNote: row.paymentNote ?? '',
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
  const records = await persistPayrollForMonth(month);
  await audit(req, 'FINALIZE', 'SalaryRecord', month, { records: records.length });
  res.json({ month, generated: records.length });
}));

salaryRouter.patch('/:month/:guardId/payment', asyncHandler(async (req, res) => {
  const { start } = payrollPeriod(String(req.params.month));
  const guardId = String(req.params.guardId);
  const input = z.object({ status: z.enum(['PAID', 'UNPAID']), note: z.string().trim().max(300).optional().or(z.literal('')) }).parse(req.body);
  const guard = await prisma.guard.findUnique({ where: { id: guardId }, select: { id: true, name: true } });
  if (!guard) return res.status(404).json({ message: 'Guard not found' });
  const paidAt = input.status === 'PAID' ? new Date() : null;
  const payment = await prisma.payrollPayment.upsert({
    where: { guardId_monthYear: { guardId, monthYear: start } },
    create: { guardId, monthYear: start, status: input.status, paidAt, note: input.note || null, updatedById: req.user!.id },
    update: { status: input.status, paidAt, note: input.note || null, updatedById: req.user!.id },
  });
  await audit(req, 'UPDATE_PAYMENT_STATUS', 'PayrollPayment', payment.id, { guardId, guard: guard.name, month: req.params.month, status: input.status });
  res.json({ data: payment });
}));

salaryRouter.get('/:month', asyncHandler(async (req, res) => {
  res.json(await getLivePayroll(String(req.params.month)));
}));
