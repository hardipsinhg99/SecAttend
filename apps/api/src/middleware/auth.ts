import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';

type TokenPayload = { sub: string; email: string; role: Role; name: string };

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new AppError(401, 'Authentication required');
    const payload = jwt.verify(token, config.JWT_SECRET) as TokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') throw new AppError(401, 'Account is unavailable');
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch (error) {
    next(error instanceof AppError ? error : new AppError(401, 'Invalid or expired session'));
  }
}

export const authorize = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission for this action'));
  next();
};
