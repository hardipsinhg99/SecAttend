import { describe, expect, it } from 'vitest';

function calculate(gross: number, days: number, leaveDays: number) {
  const dailyRate = gross / days;
  const deductions = dailyRate * leaveDays;
  return { dailyRate, deductions, net: gross - deductions };
}

describe('salary calculation', () => {
  it('deducts one daily rate per leave day', () => {
    const result = calculate(30000, 31, 2);
    expect(result.dailyRate).toBeCloseTo(967.74, 2);
    expect(result.deductions).toBeCloseTo(1935.48, 2);
    expect(result.net).toBeCloseTo(28064.52, 2);
  });
});
