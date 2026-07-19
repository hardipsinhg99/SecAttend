import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  ATTENDANCE_EDIT_HOURS: z.coerce.number().int().min(0).default(48),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = schema.parse(process.env);
