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

  it('reads day-by-day P/A attendance columns from a monthly site register', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ATTENDANCE REGISTER', 'MONTH', 'JAN-25'],
      ['SITE: JUNIPER BHOGAT'],
      ['Sr No', 'Security Guard Full Name', 'Date of Joining', 'Mobile No.', 'Location Detail', 'WED', 'THU', 'FRI', 'ABSENT', 'PRESENT DAYS'],
      ['', '', '', '', '', 1, 2, 3, '', ''],
      [1, 'SHETA NSINH BACHUBHA JADEJA', '10-09-2024', 9316174816, 'ZERO POINT (NIGHT)', 'P', 'P', 'A', 1, 2],
    ]);
    const rows = extractGuardImportRows(sheet);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.period).toEqual({ year: 2025, month: 0 });
    expect(rows[0]?.attendance).toEqual([
      { date: new Date(Date.UTC(2025, 0, 1)), status: 'PRESENT' },
      { date: new Date(Date.UTC(2025, 0, 2)), status: 'PRESENT' },
      { date: new Date(Date.UTC(2025, 0, 3)), status: 'ABSENT' },
    ]);
    expect(rows[0]).toMatchObject({ reportedAbsentDays: 1, reportedPresentDays: 2 });
  });

  it('ignores blank or unrecognized day marks instead of fabricating attendance', () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['ATTENDANCE REGISTER', 'MONTH', 'FEB-25'],
      ['SITE: JUNIPER BHOGAT'],
      ['Sr No', 'Security Guard Full Name', 'Date of Joining', 'Mobile No.', 'Location Detail', 'SAT', 'SUN', 'MON'],
      ['', '', '', '', '', 1, 2, 3],
      [1, 'GOJIYA MAHESHKHIMBHAI', '01-06-2025', 9512515230, 'ZERO POINT (DAY)', 'P', '', 'X'],
    ]);
    const rows = extractGuardImportRows(sheet);
    expect(rows[0]?.attendance).toEqual([{ date: new Date(Date.UTC(2025, 1, 1)), status: 'PRESENT' }]);
  });
});

