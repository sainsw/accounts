import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatMonth,
  getYearRange,
  isInRange,
  cn,
  getFinancialYear,
} from '../lib/utils';

describe('formatCurrency', () => {
  it('formats positive amount', () => {
    expect(formatCurrency(1234.56, '£')).toBe('£1,234.56');
  });

  it('formats negative amount', () => {
    expect(formatCurrency(-500, '$')).toBe('-$500.00');
  });

  it('formats zero', () => {
    expect(formatCurrency(0, '€')).toBe('€0.00');
  });
});

describe('formatDate', () => {
  it('formats with en-US locale by default', () => {
    const result = formatDate('2025-03-05');
    expect(result).toContain('Mar');
    expect(result).toContain('2025');
  });

  it('formats with en-GB locale', () => {
    const result = formatDate('2025-03-05', 'en-GB');
    expect(result).toContain('Mar');
    expect(result).toContain('2025');
  });

  it('returns empty for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('formatMonth', () => {
  it('formats month string', () => {
    const result = formatMonth('2025-03-01');
    expect(result).toContain('March');
    expect(result).toContain('2025');
  });

  it('supports locale parameter', () => {
    const result = formatMonth('2025-03-01', 'en-GB');
    expect(result).toContain('March');
    expect(result).toContain('2025');
  });
});

describe('getYearRange', () => {
  it('returns calendar year range', () => {
    const range = getYearRange(2024, 'calendar');
    expect(range.start).toBe('2024-01-01');
    expect(range.end).toBe('2024-12-31');
  });

  it('returns apr-mar range', () => {
    const range = getYearRange(2024, 'apr-mar');
    expect(range.start).toBe('2024-04-01');
    expect(range.end).toBe('2025-03-31');
  });

  it('returns jul-jun range', () => {
    const range = getYearRange(2024, 'jul-jun');
    expect(range.start).toBe('2024-07-01');
    expect(range.end).toBe('2025-06-30');
  });

  it('returns oct-sep range', () => {
    const range = getYearRange(2024, 'oct-sep');
    expect(range.start).toBe('2024-10-01');
    expect(range.end).toBe('2025-09-30');
  });
});

describe('isInRange', () => {
  it('returns true for date in range', () => {
    expect(isInRange('2024-06-15', '2024-01-01', '2024-12-31')).toBe(true);
  });

  it('returns true for boundary dates', () => {
    expect(isInRange('2024-01-01', '2024-01-01', '2024-12-31')).toBe(true);
    expect(isInRange('2024-12-31', '2024-01-01', '2024-12-31')).toBe(true);
  });

  it('returns false for date outside range', () => {
    expect(isInRange('2025-01-01', '2024-01-01', '2024-12-31')).toBe(false);
  });
});

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});

describe('getFinancialYear', () => {
  it('returns year for calendar year', () => {
    expect(getFinancialYear('2024-06-15', 'calendar')).toBe(2024);
  });

  it('returns correct year for apr-mar (before April)', () => {
    expect(getFinancialYear('2025-02-15', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (after April)', () => {
    expect(getFinancialYear('2024-06-15', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (exactly April)', () => {
    expect(getFinancialYear('2024-04-01', 'apr-mar')).toBe(2024);
  });

  it('returns correct year for apr-mar (March)', () => {
    expect(getFinancialYear('2024-03-31', 'apr-mar')).toBe(2023);
  });
});
