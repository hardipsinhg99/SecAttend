import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getLivePayroll } from '../lib/payroll.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const locationFilter = req.user!.role === 'MANAGER'
    ? { location: { managers: { some: { id: req.user!.id } } } }
    : {};
  const currentMonth = today.toISOString().slice(0, 7);
  const [totalGuards, managers, markedToday, leaveToday, recentActivity, locationStats, payroll] = await Promise.all([
    prisma.guard.count({ where: { status: 'ACTIVE', ...locationFilter } }),
    prisma.user.count({ where: { role: 'MANAGER', status: 'ACTIVE' } }),
    prisma.attendance.count({ where: { date: today, guard: locationFilter } }),
    prisma.attendance.count({ where: { date: today, status: 'ON_LEAVE', guard: locationFilter } }),
    prisma.auditLog.findMany({ where: req.user!.role === 'MANAGER' ? { actorId: req.user!.id } : {}, take: 6, orderBy: { createdAt: 'desc' }, include: { actor: { select: { name: true } } } }),
    prisma.location.findMany({ where: req.user!.role === 'MANAGER' ? { managers: { some: { id: req.user!.id } } } : {}, include: { _count: { select: { guards: { where: { status: 'ACTIVE' } }, managers: { where: { status: 'ACTIVE' } } } } }, orderBy: { name: 'asc' } }),
    req.user!.role === 'ADMIN' ? getLivePayroll(currentMonth) : Promise.resolve(null),
  ]);
  res.json({
    stats: {
      totalGuards,
      activeManagers: managers,
      markedToday,
      presentToday: markedToday - leaveToday,
      leaveToday,
      attendancePercent: totalGuards ? Math.round((markedToday / totalGuards) * 100) : 0,
      unmarkedToday: Math.max(0, totalGuards - markedToday),
      monthlyGuardPayroll: payroll?.totals.guardNet ?? 0,
      monthlyCompanyBilling: payroll?.totals.companyNet ?? 0,
    },
    locationStats,
    recentActivity,
  });
}));
