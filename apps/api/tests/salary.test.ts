import { describe, expect, it } from 'vitest';

function calculate(guardGross: number, companyGross: number, days: number, absentDays = 0, preEmploymentDays = 0) {
  const guardDailyRate = guardGross / days;
  const companyDailyRate = companyGross / days;
  const nonPayableDays = absentDays + preEmploymentDays;
  return {
    guardDailyRate,
    guardDeductions: guardDailyRate * nonPayableDays,
    guardNet: guardGross - guardDailyRate * nonPayableDays,
    companyNet: companyGross - companyDailyRate * nonPayableDays,
  };
}

describe('salary calculation', () => {
  it('deducts one daily rate per absent day', () => {
    const result = calculate(30000, 38000, 31, 2);
    expect(result.guardDailyRate).toBeCloseTo(967.74, 2);
    expect(result.guardDeductions).toBeCloseTo(1935.48, 2);
    expect(result.guardNet).toBeCloseTo(28064.52, 2);
    expect(result.companyNet).toBeCloseTo(35548.39, 2);
  });

  it('prorates a mid-month joiner and deducts absences', () => {
    const result = calculate(28000, 35000, 28, 1, 11);
    expect(result.guardNet).toBe(16000);
    expect(result.companyNet).toBe(20000);
  });
});
