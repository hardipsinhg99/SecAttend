import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/', asyncHandler(async (req, res) => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const locationFilter = req.user!.role === 'MANAGER'
    ? { location: { managers: { some: { id: req.user!.id } } } }
    : {};
  const [totalGuards, managers, markedToday, leaveToday, recentActivity, locationStats] = await Promise.all([
    prisma.guard.count({ where: { status: 'ACTIVE', ...locationFilter } }),
    prisma.user.count({ where: { role: 'MANAGER', status: 'ACTIVE' } }),
    prisma.attendance.count({ where: { date: today, guard: locationFilter } }),
    prisma.attendance.count({ where: { date: today, status: 'ON_LEAVE', guard: locationFilter } }),
    prisma.auditLog.findMany({ take: 6, orderBy: { createdAt: 'desc' }, include: { actor: { select: { name: true } } } }),
    prisma.location.findMany({ include: { _count: { select: { guards: { where: { status: 'ACTIVE' } }, managers: { where: { status: 'ACTIVE' } } } } }, orderBy: { name: 'asc' } }),
  ]);
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const salaryRecords = await prisma.salaryRecord.count({ where: { monthYear: month } });
  res.json({
    stats: {
      totalGuards,
      activeManagers: managers,
      markedToday,
      presentToday: markedToday - leaveToday,
      leaveToday,
      attendancePercent: totalGuards ? Math.round((markedToday / totalGuards) * 100) : 0,
      pendingSalaries: Math.max(0, totalGuards - salaryRecords),
    },
    locationStats,
    recentActivity,
  });
}));
