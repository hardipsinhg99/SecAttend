import type { Guard, Location } from '@prisma/client';
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

export type PayrollGuard = Guard & { location: Location; attendance: { date: Date; status: 'PRESENT' | 'ABSENT' | 'ON_LEAVE' }[] };

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
  const leaveDays = eligibleAttendance.filter((record) => record.status === 'ON_LEAVE').length;
  const unpaidDays = absentDays + leaveDays;
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
    leaveDays,
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
  const guards = await prisma.guard.findMany({
    where: { status: 'ACTIVE' },
    include: { location: true, attendance: { where: { date: { gte: start, lt: end } }, select: { date: true, status: true } } },
    orderBy: { name: 'asc' },
  });
  const data = guards.map((guard) => calculatePayrollRow(guard, month, start, totalDays));
  const totals = data.reduce((sum, row) => ({
    guardGross: money(sum.guardGross + row.guardGrossSalary),
    guardDeductions: money(sum.guardDeductions + row.guardDeductions),
    guardNet: money(sum.guardNet + row.guardNetSalary),
    companyGross: money(sum.companyGross + row.companyGrossSalary),
    companyDeductions: money(sum.companyDeductions + row.companyDeductions),
    companyNet: money(sum.companyNet + row.companyNetSalary),
    margin: money(sum.margin + row.companyNetSalary - row.guardNetSalary),
  }), { guardGross: 0, guardDeductions: 0, guardNet: 0, companyGross: 0, companyDeductions: 0, companyNet: 0, margin: 0 });
  return { data, totals, period: { month, totalDays, calculatedAt: new Date().toISOString() } };
}
