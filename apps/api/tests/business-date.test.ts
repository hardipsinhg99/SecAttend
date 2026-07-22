import { describe, expect, it } from 'vitest';
import { businessDateKey } from '../src/lib/business-date.js';

describe('businessDateKey', () => {
  it('uses the India calendar date after midnight IST while UTC is still yesterday', () => {
    expect(businessDateKey(new Date('2026-07-22T19:31:00.000Z'))).toBe('2026-07-23');
  });

  it('does not advance the India date before midnight IST', () => {
    expect(businessDateKey(new Date('2026-07-22T18:29:59.000Z'))).toBe('2026-07-22');
  });
});

