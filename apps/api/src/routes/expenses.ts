import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler, AppError, parsePagination } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { audit } from '../lib/audit.js';

export const expensesRouter = Router();
const expenseInput = z.object({
  title: z.string().trim().min(2).max(150),
  category: z.string().trim().min(2).max(60),
  amount: z.coerce.number().positive().max(10_000_000),
  expenseDate: z.coerce.date(),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

expensesRouter.use(authenticate, authorize('ADMIN'));

expensesRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip } = parsePagination(req.query);
  const search = String(req.query.search ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;
  const where: Prisma.ExpenseWhereInput = {
    ...(category && { category: { equals: category, mode: 'insensitive' } }),
    ...((from || to) && { expenseDate: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
    ...(search && { OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { category: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } },
    ] }),
  };
  const [data, total, aggregate] = await Promise.all([
    prisma.expense.findMany({ where, include: { createdBy: { select: { id: true, name: true } } }, skip, take: pageSize, orderBy: { expenseDate: 'desc' } }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  res.json({ data, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) }, totalAmount: aggregate._sum.amount ?? 0 });
}));

expensesRouter.get('/:id', asyncHandler(async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: String(req.params.id) }, include: { createdBy: { select: { id: true, name: true } } } });
  if (!expense) throw new AppError(404, 'Expense not found');
  res.json({ data: expense });
}));

expensesRouter.post('/', asyncHandler(async (req, res) => {
  const input = expenseInput.parse(req.body);
  const expense = await prisma.expense.create({
    data: { ...input, note: input.note || null, createdById: req.user!.id },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  await audit(req, 'CREATE', 'Expense', expense.id, { title: expense.title, amount: expense.amount });
  res.status(201).json({ data: expense });
}));

expensesRouter.patch('/:id', asyncHandler(async (req, res) => {
  const input = expenseInput.partial().parse(req.body);
  if (!Object.keys(input).length) throw new AppError(422, 'At least one field is required');
  const existing = await prisma.expense.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, 'Expense not found');
  const expense = await prisma.expense.update({
    where: { id: existing.id },
    data: { ...input, ...(input.note !== undefined && { note: input.note || null }) },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  await audit(req, 'UPDATE', 'Expense', expense.id, { fields: Object.keys(input) });
  res.json({ data: expense });
}));

expensesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: String(req.params.id) } });
  if (!existing) throw new AppError(404, 'Expense not found');
  await prisma.expense.delete({ where: { id: existing.id } });
  await audit(req, 'DELETE', 'Expense', existing.id, { title: existing.title });
  res.status(204).send();
}));
