import { describe, expect, it } from 'vitest';

function calculate(guardGross: number, companyGross: number, days: number, leaveDays: number) {
  const guardDailyRate = guardGross / days;
  const companyDailyRate = companyGross / days;
  return {
    guardDailyRate,
    guardDeductions: guardDailyRate * leaveDays,
    guardNet: guardGross - guardDailyRate * leaveDays,
    companyNet: companyGross - companyDailyRate * leaveDays,
  };
}

describe('salary calculation', () => {
  it('deducts one daily rate per leave day', () => {
    const result = calculate(30000, 38000, 31, 2);
    expect(result.guardDailyRate).toBeCloseTo(967.74, 2);
    expect(result.guardDeductions).toBeCloseTo(1935.48, 2);
    expect(result.guardNet).toBeCloseTo(28064.52, 2);
    expect(result.companyNet).toBeCloseTo(35548.39, 2);
  });
});
