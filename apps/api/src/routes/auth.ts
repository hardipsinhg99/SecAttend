import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { asyncHandler, AppError } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(async (req, res) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { locations: true } });
  if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, 'Email or password is incorrect');
  }
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role, name: user.name }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, locations: user.locations } });
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, include: { locations: true } });
  res.json({ user: { ...user, passwordHash: undefined } });
}));
