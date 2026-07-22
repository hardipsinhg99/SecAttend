import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const asyncHandler = (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => void handler(req, res, next).catch(next);

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, `Route ${req.method} ${req.path} was not found`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return res.status(422).json({ error: 'Validation failed', details: error.flatten() });
  }
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return res.status(409).json({ error: 'A record with this unique value already exists' });
  }
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  if (process.env.NODE_ENV !== 'production') return res.status(500).json({ error: message });
  return res.status(500).json({ error: 'Unexpected server error' });
}

export function parsePagination(query: Request['query']) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}
