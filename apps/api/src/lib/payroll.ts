import type { Guard, Location } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from './http.js';
import { prisma } from './prisma.js';

export function payrollPeriod(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError(422, 'Month must use YYYY-MM format');
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const totalDays = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end, totalDays };
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type PayrollGuard = Guard & { location: Location; attendance: { date: Date; status: 'PRESENT' | 'ABSENT' }[] };

export function calculatePayrollRow(guard: PayrollGuard, month: string, start: Date, totalDays: number) {
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), totalDays));
  const joiningDate = guard.joiningDate;
  const preEmploymentDays = joiningDate && joiningDate > start
    ? Math.min(totalDays, Math.max(0, Math.round((joiningDate.getTime() - start.getTime()) / 86_400_000)))
    : 0;
  const eligibleDays = joiningDate && joiningDate > monthEnd ? 0 : totalDays - preEmploymentDays;
  const eligibleAttendance = guard.attendance.filter((record) => !joiningDate || record.date >= joiningDate);
  const presentDays = eligibleAttendance.filter((record) => record.status === 'PRESENT').length;
  const absentDays = eligibleAttendance.filter((record) => record.status === 'ABSENT').length;
  const unpaidDays = absentDays;
  const payableDays = Math.max(0, eligibleDays - unpaidDays);
  const guardGrossSalary = Number(guard.guardMonthlySalary);
  const companyGrossSalary = Number(guard.companyMonthlySalary);
  const guardDailyRate = money(guardGrossSalary / totalDays);
  const companyDailyRate = money(companyGrossSalary / totalDays);
  const guardDeductions = money((guardGrossSalary / totalDays) * (preEmploymentDays + unpaidDays));
  const companyDeductions = money((companyGrossSalary / totalDays) * (preEmploymentDays + unpaidDays));
  return {
    id: `${guard.id}:${month}`,
    totalDays,
    eligibleDays,
    payableDays,
    presentDays,
    absentDays,
    guardDailyRate,
    guardGrossSalary,
    guardDeductions,
    guardNetSalary: money(guardGrossSalary - guardDeductions),
    companyDailyRate,
    companyGrossSalary,
    companyDeductions,
    companyNetSalary: money(companyGrossSalary - companyDeductions),
    guard: { id: guard.id, name: guard.name, employeeId: guard.employeeId, joiningDate: guard.joiningDate, shiftType: guard.shiftType, postDetail: guard.postDetail, project: guard.project, village: guard.village, location: guard.location },
  };
}

export async function getLivePayroll(month: string) {
  const { start, end, totalDays } = payrollPeriod(month);
  const [guards, payments] = await Promise.all([
    prisma.guard.findMany({
      where: { status: 'ACTIVE' },
      include: { location: true, attendance: { where: { date: { gte: start, lt: end } }, select: { date: true, status: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.payrollPayment.findMany({ where: { monthYear: start } }),
  ]);
  const paymentByGuard = new Map(payments.map((payment) => [payment.guardId, payment]));
  const data = guards.map((guard) => {
    const payment = paymentByGuard.get(guard.id);
    return {
      ...calculatePayrollRow(guard, month, start, totalDays),
      paymentStatus: payment?.status ?? 'UNPAID' as const,
      paidAt: payment?.paidAt ?? null,
      paymentNote: payment?.note ?? null,
    };
  });
  const totals = data.reduce((sum, row) => ({
    guardGross: money(sum.guardGross + row.guardGrossSalary),
    guardDeductions: money(sum.guardDeductions + row.guardDeductions),
    guardNet: money(sum.guardNet + row.guardNetSalary),
    guardPaid: money(sum.guardPaid + (row.paymentStatus === 'PAID' ? row.guardNetSalary : 0)),
    companyGross: money(sum.companyGross + row.companyGrossSalary),
    companyDeductions: money(sum.companyDeductions + row.companyDeductions),
    companyNet: money(sum.companyNet + row.companyNetSalary),
    margin: money(sum.margin + row.companyNetSalary - row.guardNetSalary),
  }), { guardGross: 0, guardDeductions: 0, guardNet: 0, guardPaid: 0, companyGross: 0, companyDeductions: 0, companyNet: 0, margin: 0 });
  return { data, totals, period: { month, totalDays, calculatedAt: new Date().toISOString() } };
}

export async function persistPayrollForMonth(month: string) {
  const { start } = payrollPeriod(month);
  const payroll = await getLivePayroll(month);
  return prisma.$transaction(payroll.data.map((row) => prisma.salaryRecord.upsert({
    where: { guardId_monthYear: { guardId: row.guard.id, monthYear: start } },
    create: {
      guardId: row.guard.id, monthYear: start, totalDays: row.totalDays, eligibleDays: row.eligibleDays, presentDays: row.presentDays, absentDays: row.absentDays, leaveDays: 0,
      guardDailyRate: new Prisma.Decimal(row.guardDailyRate), guardGrossSalary: new Prisma.Decimal(row.guardGrossSalary), guardDeductions: new Prisma.Decimal(row.guardDeductions), guardNetSalary: new Prisma.Decimal(row.guardNetSalary),
      companyDailyRate: new Prisma.Decimal(row.companyDailyRate), companyGrossSalary: new Prisma.Decimal(row.companyGrossSalary), companyDeductions: new Prisma.Decimal(row.companyDeductions), companyNetSalary: new Prisma.Decimal(row.companyNetSalary),
    },
    update: {
      totalDays: row.totalDays, eligibleDays: row.eligibleDays, presentDays: row.presentDays, absentDays: row.absentDays, leaveDays: 0,
      guardDailyRate: new Prisma.Decimal(row.guardDailyRate), guardGrossSalary: new Prisma.Decimal(row.guardGrossSalary), guardDeductions: new Prisma.Decimal(row.guardDeductions), guardNetSalary: new Prisma.Decimal(row.guardNetSalary),
      companyDailyRate: new Prisma.Decimal(row.companyDailyRate), companyGrossSalary: new Prisma.Decimal(row.companyGrossSalary), companyDeductions: new Prisma.Decimal(row.companyDeductions), companyNetSalary: new Prisma.Decimal(row.companyNetSalary), generatedAt: new Date(),
    },
  })));
}
