import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { excelDate, extractGuardImportRows } from '../src/lib/guard-import.js';

describe('guard workbook import', () => {
  it('reads the provided attendance-register layout and preserves formatted IDs', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ATTENDANCE REGISTER'],
      ['SITE: JUNIPER BHATIYA'],
      ['Sr. No', 'EMP', 'SECURITY GUARD FULL NAME', 'DATE OF JOINING', 'MOBILE NO.', 'FIX SALARY', 'PROJECT', 'VILLEGE', 'TYPE', 'LOCATION DETAIL'],
      ['', 'CODE', '', '', '', '', '', '', '', ''],
      [1, '0055', 'MADAM NATHABHAI SAVABHAI', '7/3/25', 9978089479, 10000, 'JGKPL CTU', 'MAHADEVIYA', 'DAY', 'MAH-327'],
      [2, 'NEW', 'DHAVAL NANDANIYA', '18/7/2025', 9427655506, 20000, 'JGKPL', 'SUPERVISOR', 'DAY', 'SUPERVISOR'],
    ]);
    const rows = extractGuardImportRows(sheet);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rowNumber: 5, employeeId: '0055', location: 'JUNIPER BHATIYA', shiftType: 'DAY', guardMonthlySalary: 10000, companyMonthlySalary: 10000 });
    expect(rows[0]?.joiningDate).toEqual(new Date('2025-03-07T00:00:00.000Z'));
    expect(rows[1]?.designation).toBe('SUPERVISOR');
  });

  it('continues to read the documented flat roster format', () => {
    const sheet = XLSX.utils.json_to_sheet([{ Name: 'Test Guard', EmployeeID: 'NEW', Phone: '9876543210', Location: 'Main Site', GuardMonthlySalary: 12000, CompanyMonthlySalary: 15000, Shift: 'night' }]);
    expect(extractGuardImportRows(sheet)[0]).toMatchObject({ name: 'Test Guard', location: 'Main Site', shiftType: 'NIGHT', guardMonthlySalary: 12000, companyMonthlySalary: 15000 });
  });

  it('parses Indian day-first dates without swapping month and day', () => {
    expect(excelDate('20/12/2025')).toEqual(new Date('2025-12-20T00:00:00.000Z'));
    expect(excelDate('31/02/2025')).toBeUndefined();
  });
});

