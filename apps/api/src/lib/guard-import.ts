import XLSX from 'xlsx';

export type AttendanceMark = { date: Date; status: 'PRESENT' | 'ABSENT' };

export type GuardImportRow = {
  rowNumber: number;
  name: string;
  employeeId: string;
  phone: string;
  email: string;
  address: string;
  location: string;
  joiningDate: Date | string | undefined;
  project: string;
  village: string;
  shiftType: string;
  postDetail: string;
  designation: 'SECURITY_GUARD' | 'SUPERVISOR';
  guardMonthlySalary: unknown;
  companyMonthlySalary: unknown;
  period: { year: number; month: number } | undefined;
  attendance: AttendanceMark[];
  reportedAbsentDays: number | undefined;
  reportedPresentDays: number | undefined;
};

const aliases = {
  name: ['NAME', 'FULLNAME', 'GUARD', 'SECURITYGUARDFULLNAME'],
  employeeId: ['EMPLOYEEID', 'EMPLOYEECODE', 'EMPCODE'],
  phone: ['PHONE', 'PHONENUMBER', 'MOBILE', 'MOBILENO'],
  email: ['EMAIL', 'EMAILADDRESS'],
  address: ['ADDRESS', 'RESIDENTIALADDRESS'],
  location: ['LOCATION', 'ASSIGNEDLOCATION', 'SITE'],
  joiningDate: ['DATEOFJOINING', 'JOININGDATE'],
  project: ['PROJECT'],
  village: ['VILLAGE', 'VILLEGE', 'VILLAGEAREA'],
  shiftType: ['SHIFT', 'SHIFTTYPE', 'TYPE'],
  postDetail: ['POSTDETAIL', 'LOCATIONDETAIL', 'POSTLOCATIONDETAIL'],
  designation: ['DESIGNATION'],
  guardMonthlySalary: ['GUARDMONTHLYSALARY', 'MONTHLYSALARY', 'FIXSALARY', 'GUARDSALARY'],
  companyMonthlySalary: ['COMPANYMONTHLYSALARY', 'COMPANYSALARY', 'COMPANYBILLING', 'BILLINGSALARY'],
  reportedAbsentDays: ['ABSENT', 'ABSENTDAYS'],
  reportedPresentDays: ['PRESENTDAYS', 'PRESENTDAY'],
} as const;

const MONTH_INDEX: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

function extractPeriod(precedingText: string[]) {
  for (const value of precedingText) {
    const match = value.toUpperCase().match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-(\d{2})\b/);
    if (match) return { year: 2000 + Number(match[2]), month: MONTH_INDEX[match[1]!]! };
  }
  return undefined;
}

function headerKey(value: unknown) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function text(value: unknown) {
  return String(value ?? '').trim();
}

export function excelDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)) : undefined;
  }
  const input = text(value);
  if (!input) return undefined;
  const localDate = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (localDate) {
    const yearValue = Number(localDate[3]);
    const year = yearValue < 100 ? 2000 + yearValue : yearValue;
    const month = Number(localDate[2]);
    const day = Number(localDate[1]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return parsed;
    return undefined;
  }
  return input;
}

export function extractGuardImportRows(sheet: XLSX.WorkSheet): GuardImportRow[] {
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: true });
  const displayRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  const knownNameHeaders = new Set<string>(aliases.name);
  const headerIndex = displayRows.findIndex((row) => row.some((cell) => knownNameHeaders.has(headerKey(cell))));
  if (headerIndex < 0) return [];

  const headerRow = displayRows[headerIndex] ?? [];
  const isAttendanceRegister = headerRow.some((cell) => headerKey(cell) === 'SECURITYGUARDFULLNAME');
  const secondaryHeader = isAttendanceRegister ? displayRows[headerIndex + 1] ?? [] : [];
  const headers = headerRow.map((cell, index) => headerKey(`${text(cell)} ${text(secondaryHeader[index])}`));
  const column = (field: keyof typeof aliases) => headers.findIndex((value) => aliases[field].some((alias) => value === alias));
  const columns = Object.fromEntries(Object.keys(aliases).map((field) => [field, column(field as keyof typeof aliases)])) as Record<keyof typeof aliases, number>;
  if (columns.name < 0) return [];

  const precedingText = displayRows.slice(0, headerIndex).flat().map(text);
  const siteLocation = precedingText.find((value) => /^SITE\s*:/i.test(value))?.replace(/^SITE\s*:\s*/i, '').trim() ?? '';
  const period = isAttendanceRegister ? extractPeriod(precedingText) : undefined;
  const daysInMonth = period ? new Date(Date.UTC(period.year, period.month + 1, 0)).getUTCDate() : 0;
  const dayColumns: { index: number; day: number }[] = [];
  if (isAttendanceRegister) {
    headerRow.forEach((cell, index) => {
      const day = Number(text(secondaryHeader[index]));
      if (/^(MON|TUE|WED|THU|FRI|SAT|SUN)/i.test(text(cell)) && Number.isInteger(day) && day >= 1 && day <= 31) {
        dayColumns.push({ index, day });
      }
    });
  }
  const startIndex = headerIndex + (isAttendanceRegister ? 2 : 1);
  const valueAt = (row: unknown[], field: keyof typeof aliases) => columns[field] < 0 ? '' : row[columns[field]];
  const output: GuardImportRow[] = [];

  for (let index = startIndex; index < rawRows.length; index += 1) {
    const raw = rawRows[index] ?? [];
    const display = displayRows[index] ?? [];
    if (isAttendanceRegister && typeof raw[0] !== 'number') continue;
    const name = text(valueAt(display, 'name'));
    if (!name) continue;
    const guardSalary = valueAt(raw, 'guardMonthlySalary');
    const companySalary = valueAt(raw, 'companyMonthlySalary');
    const village = text(valueAt(display, 'village'));
    const postDetail = text(valueAt(display, 'postDetail'));
    const explicitDesignation = text(valueAt(display, 'designation')).toUpperCase();
    const supervisor = explicitDesignation === 'SUPERVISOR' || village.toUpperCase() === 'SUPERVISOR' || postDetail.toUpperCase() === 'SUPERVISOR';
    const attendance: AttendanceMark[] = [];
    if (period) {
      for (const { index: colIndex, day } of dayColumns) {
        if (day > daysInMonth) continue;
        const mark = text(display[colIndex]).toUpperCase();
        if (mark === 'P' || mark === 'A') {
          attendance.push({ date: new Date(Date.UTC(period.year, period.month, day)), status: mark === 'P' ? 'PRESENT' : 'ABSENT' });
        }
      }
    }
    const reportedAbsent = Number(text(valueAt(display, 'reportedAbsentDays')));
    const reportedPresent = Number(text(valueAt(display, 'reportedPresentDays')));
    output.push({
      rowNumber: index + 1,
      name,
      employeeId: text(valueAt(display, 'employeeId')),
      phone: text(valueAt(display, 'phone')),
      email: text(valueAt(display, 'email')),
      address: text(valueAt(display, 'address')),
      location: text(valueAt(display, 'location')) || siteLocation,
      joiningDate: excelDate(valueAt(raw, 'joiningDate')),
      project: text(valueAt(display, 'project')),
      village,
      shiftType: text(valueAt(display, 'shiftType')).toUpperCase(),
      postDetail,
      designation: supervisor ? 'SUPERVISOR' : 'SECURITY_GUARD',
      guardMonthlySalary: guardSalary,
      companyMonthlySalary: companySalary === '' ? guardSalary : companySalary,
      period,
      attendance,
      reportedAbsentDays: Number.isFinite(reportedAbsent) && text(valueAt(display, 'reportedAbsentDays')) !== '' ? reportedAbsent : undefined,
      reportedPresentDays: Number.isFinite(reportedPresent) && text(valueAt(display, 'reportedPresentDays')) !== '' ? reportedPresent : undefined,
    });
  }
  return output;
}
