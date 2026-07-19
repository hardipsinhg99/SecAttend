import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(config.PORT, () => {
  process.stdout.write(`SecAttend API listening on port ${config.PORT}\n`);
});

async function shutdown(signal: string) {
  process.stdout.write(`${signal} received, shutting down\n`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
