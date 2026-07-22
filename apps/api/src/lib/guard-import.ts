import XLSX from 'xlsx';

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
} as const;

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

  const siteLocation = displayRows.slice(0, headerIndex).flat().map(text).find((value) => /^SITE\s*:/i.test(value))?.replace(/^SITE\s*:\s*/i, '').trim() ?? '';
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
    });
  }
  return output;
}
