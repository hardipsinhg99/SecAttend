import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const locations = await Promise.all(([
    ['Harbor Point', 'Bandra Kurla Complex, Mumbai'],
    ['Orchid Tech Park', 'Goregaon East, Mumbai'],
    ['Meridian Hospital', 'Andheri West, Mumbai'],
  ] as const).map(([name, address]) => prisma.location.upsert({ where: { name }, update: { address, status: 'ACTIVE' }, create: { name, address } })));
  const passwordHash = await bcrypt.hash('Secure@123', 12);
  const admin = await prisma.user.upsert({ where: { email: 'admin@secattend.local' }, update: {}, create: { name: 'Aarav Mehta', email: 'admin@secattend.local', phone: '+91 98765 01001', role: Role.ADMIN, passwordHash } });
  const manager = await prisma.user.upsert({ where: { email: 'manager@secattend.local' }, update: { locations: { set: locations.slice(0, 2).map(({ id }) => ({ id })) } }, create: { name: 'Priya Sharma', email: 'manager@secattend.local', phone: '+91 98765 01002', role: Role.MANAGER, passwordHash, locations: { connect: locations.slice(0, 2).map(({ id }) => ({ id })) } } });
  const names = ['Rohan Patil', 'Sanjay Kumar', 'Vikram Singh', 'Imran Shaikh', 'Deepak Yadav', 'Nitin Jadhav', 'Arjun Pawar', 'Manoj Gupta', 'Kiran More', 'Ravi Chavan', 'Suresh Nair', 'Ajay Verma'];
  for (const [index, name] of names.entries()) {
    const employeeId = `SG-${String(index + 101).padStart(4, '0')}`;
    const guardMonthlySalary = 24000 + (index % 4) * 1500;
    await prisma.guard.upsert({ where: { employeeId }, update: { companyMonthlySalary: guardMonthlySalary + 6000 }, create: { name, employeeId, phone: `+91 90000 ${String(11000 + index)}`, email: `guard${index + 1}@example.com`, address: `${20 + index}, Mumbai, Maharashtra`, guardMonthlySalary, companyMonthlySalary: guardMonthlySalary + 6000, locationId: locations[index % locations.length]!.id } });
  }
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const guards = await prisma.guard.findMany({ where: { status: 'ACTIVE' } });
  for (let offset = 0; offset < 8; offset++) {
    const date = new Date(today); date.setUTCDate(date.getUTCDate() - offset);
    for (const [index, guard] of guards.entries()) {
      if (offset === 0 && index > 8) continue;
      await prisma.attendance.upsert({ where: { guardId_date: { guardId: guard.id, date } }, update: {}, create: { guardId: guard.id, date, status: (index + offset) % 11 === 0 ? 'ABSENT' : 'PRESENT', markedById: manager.id } });
    }
  }
  const auditCount = await prisma.auditLog.count();
  if (!auditCount) await prisma.auditLog.createMany({ data: [
    { actorId: admin.id, action: 'CREATE', entity: 'Manager', entityId: manager.id },
    { actorId: manager.id, action: 'MARK_ATTENDANCE', entity: 'Attendance', entityId: today.toISOString().slice(0, 10), metadata: { records: 9 } },
    { actorId: admin.id, action: 'IMPORT', entity: 'Guard', metadata: { imported: 12, rejected: 0 } },
  ] });
}

main().finally(() => prisma.$disconnect());
