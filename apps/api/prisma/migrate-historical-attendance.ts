import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { extractGuardImportRows, type GuardImportRow } from '../src/lib/guard-import.js';
import { persistPayrollForMonth } from '../src/lib/payroll.js';

const prisma = new PrismaClient();
const SHIFT_TYPES = new Set(['DAY', 'NIGHT', 'ROTATING']);

const args = process.argv.slice(2);
const commit = !args.includes('--dry-run');
const rosterFlagIndex = args.indexOf('--roster');
const rosterPath = rosterFlagIndex >= 0 ? args[rosterFlagIndex + 1] : undefined;
const folder = args.find((value, index) => !value.startsWith('--') && args[index - 1] !== '--roster');

function locationKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.xlsx?$/i.test(entry.name) ? [path] : [];
  });
}

type RosterEntry = { employeeId?: string; guardMonthlySalary: unknown; companyMonthlySalary: unknown };

function buildRosterLookup(path: string) {
  const byPhone = new Map<string, RosterEntry>();
  const byName = new Map<string, RosterEntry>();
  const workbook = XLSX.readFile(path);
  for (const sheetName of workbook.SheetNames) {
    for (const row of extractGuardImportRows(workbook.Sheets[sheetName]!)) {
      const entry: RosterEntry = { employeeId: row.employeeId || undefined, guardMonthlySalary: row.guardMonthlySalary, companyMonthlySalary: row.companyMonthlySalary };
      if (row.phone.trim()) byPhone.set(row.phone.trim(), entry);
      byName.set(row.name.trim().toLowerCase(), entry);
    }
  }
  return { byPhone, byName };
}

async function main() {
  if (!folder) {
    process.stdout.write('Usage: tsx prisma/migrate-historical-attendance.ts <folder-of-xlsx-files> [--roster <master-roster.xlsx>] [--dry-run]\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(commit ? 'Running LIVE (writes will be committed).\n' : 'Running in --dry-run mode. No data will be written.\n');

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    process.stderr.write('No ADMIN user exists yet. Create the production administrator first (see the production reset), then re-run this script.\n');
    process.exitCode = 1;
    return;
  }

  const roster = rosterPath ? buildRosterLookup(rosterPath) : undefined;
  const files = walk(folder).sort();
  process.stdout.write(`Found ${files.length} workbook file(s). Attendance will be attributed to ${adminUser.email}.\n`);

  const existingLocations = await prisma.location.findMany();
  const locationByKey = new Map(existingLocations.map((location) => [locationKey(location.name), location]));
  const newLocationNames = new Set<string>();

  const existingGuards = await prisma.guard.findMany();
  const guardByPhone = new Map(existingGuards.filter((guard) => guard.phone).map((guard) => [`${guard.locationId}:${guard.phone}`, guard]));
  const guardByName = new Map(existingGuards.map((guard) => [`${guard.locationId}:${guard.name.trim().toLowerCase()}`, guard]));
  let dryRunGuardSeq = 0;

  const monthsTouched = new Set<string>();
  let guardsCreated = 0;
  let attendanceMarks = 0;
  const skippedNoSalary: { file: string; row: number; name: string; site: string }[] = [];
  const reconciliationMismatches: { file: string; row: number; name: string; parsedPresent: number; parsedAbsent: number; reportedPresent?: number; reportedAbsent?: number }[] = [];
  const unreadableFiles: { file: string; reason: string }[] = [];

  for (const file of files) {
    let rowsBySheet: GuardImportRow[];
    try {
      const workbook = XLSX.readFile(file);
      rowsBySheet = workbook.SheetNames.flatMap((name) => extractGuardImportRows(workbook.Sheets[name]!));
    } catch (error) {
      unreadableFiles.push({ file, reason: error instanceof Error ? error.message : String(error) });
      continue;
    }
    if (!rowsBySheet.length) {
      unreadableFiles.push({ file, reason: 'No guard rows recognized in any worksheet' });
      continue;
    }

    for (const row of rowsBySheet) {
      const key = locationKey(row.location);
      if (!key) continue;
      let location = locationByKey.get(key);
      if (!location) {
        if (commit) {
          location = await prisma.location.create({ data: { name: row.location.trim() } });
        } else {
          location = { id: `dryrun-location-${key}`, name: row.location.trim() } as unknown as (typeof existingLocations)[number];
        }
        locationByKey.set(key, location);
        newLocationNames.add(row.location.trim());
      }

      const phoneKey = row.phone.trim() ? `${location.id}:${row.phone.trim()}` : undefined;
      const nameKey = `${location.id}:${row.name.trim().toLowerCase()}`;
      let guard = (phoneKey && guardByPhone.get(phoneKey)) ?? guardByName.get(nameKey);

      if (!guard) {
        const rosterMatch = (row.phone.trim() && roster?.byPhone.get(row.phone.trim())) || roster?.byName.get(row.name.trim().toLowerCase());
        const guardMonthlySalary = Number(rosterMatch?.guardMonthlySalary ?? row.guardMonthlySalary);
        const companyMonthlySalary = Number(rosterMatch?.companyMonthlySalary ?? row.companyMonthlySalary ?? guardMonthlySalary);
        if (!Number.isFinite(guardMonthlySalary) || guardMonthlySalary <= 0) {
          skippedNoSalary.push({ file, row: row.rowNumber, name: row.name, site: row.location });
          continue;
        }
        const explicitEmployeeId = rosterMatch?.employeeId || row.employeeId || undefined;
        const data = {
          name: row.name,
          employeeId: explicitEmployeeId ?? `NEW-${randomUUID().slice(0, 8).toUpperCase()}`,
          provisionalEmployeeId: !explicitEmployeeId,
          phone: row.phone || null,
          address: row.address || null,
          locationId: location.id,
          joiningDate: row.joiningDate instanceof Date ? row.joiningDate : null,
          project: row.project || null,
          village: row.village || null,
          shiftType: SHIFT_TYPES.has(row.shiftType) ? (row.shiftType as 'DAY' | 'NIGHT' | 'ROTATING') : null,
          postDetail: row.postDetail || null,
          designation: row.designation,
          guardMonthlySalary,
          companyMonthlySalary,
        };
        if (commit) {
          guard = await prisma.guard.create({ data });
        } else {
          guard = { id: `dryrun-guard-${(dryRunGuardSeq += 1)}`, ...data } as unknown as (typeof existingGuards)[number];
        }
        guardsCreated += 1;
        if (guard.phone) guardByPhone.set(`${location.id}:${guard.phone}`, guard);
        guardByName.set(nameKey, guard);
      }

      if (row.attendance.length) {
        if (commit) {
          await prisma.$transaction(row.attendance.map((mark) => prisma.attendance.upsert({
            where: { guardId_date: { guardId: guard!.id, date: mark.date } },
            create: { guardId: guard!.id, date: mark.date, status: mark.status, markedById: adminUser.id },
            update: { status: mark.status, markedById: adminUser.id, markedAt: new Date() },
          })));
        }
        attendanceMarks += row.attendance.length;
        if (row.period) monthsTouched.add(`${row.period.year}-${String(row.period.month + 1).padStart(2, '0')}`);

        if (row.reportedAbsentDays !== undefined || row.reportedPresentDays !== undefined) {
          const parsedPresent = row.attendance.filter((mark) => mark.status === 'PRESENT').length;
          const parsedAbsent = row.attendance.filter((mark) => mark.status === 'ABSENT').length;
          if ((row.reportedPresentDays !== undefined && row.reportedPresentDays !== parsedPresent)
            || (row.reportedAbsentDays !== undefined && row.reportedAbsentDays !== parsedAbsent)) {
            reconciliationMismatches.push({ file, row: row.rowNumber, name: row.name, parsedPresent, parsedAbsent, reportedPresent: row.reportedPresentDays, reportedAbsent: row.reportedAbsentDays });
          }
        }
      }
    }
  }

  if (commit) {
    for (const month of monthsTouched) {
      const records = await persistPayrollForMonth(month);
      process.stdout.write(`Payroll recalculated for ${month}: ${records.length} salary record(s).\n`);
    }
  }

  process.stdout.write('\n--- Summary ---\n');
  process.stdout.write(`Locations auto-created: ${newLocationNames.size}${newLocationNames.size ? ` (${[...newLocationNames].join(', ')})` : ''}\n`);
  process.stdout.write(`Guards created: ${guardsCreated}\n`);
  process.stdout.write(`Attendance marks ${commit ? 'written' : 'to write'}: ${attendanceMarks}\n`);
  process.stdout.write(`Months touched: ${[...monthsTouched].sort().join(', ') || 'none'}\n`);
  process.stdout.write(`Guards skipped for missing salary: ${skippedNoSalary.length}\n`);
  for (const entry of skippedNoSalary) process.stdout.write(`  - ${entry.name} (${entry.site}) — ${entry.file}#row${entry.row}\n`);
  process.stdout.write(`Present/Absent reconciliation mismatches vs sheet totals: ${reconciliationMismatches.length}\n`);
  for (const entry of reconciliationMismatches) {
    process.stdout.write(`  - ${entry.name} in ${entry.file}#row${entry.row}: parsed P${entry.parsedPresent}/A${entry.parsedAbsent} vs sheet P${entry.reportedPresent ?? '?'}/A${entry.reportedAbsent ?? '?'}\n`);
  }
  process.stdout.write(`Unreadable/unrecognized files: ${unreadableFiles.length}\n`);
  for (const entry of unreadableFiles) process.stdout.write(`  - ${entry.file}: ${entry.reason}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
